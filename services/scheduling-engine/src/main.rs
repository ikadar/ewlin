mod engine;
mod model;
mod productivity;

use axum::{
    routing::post,
    response::sse::{Event, Sse},
    Json, Router,
};
use futures::stream::Stream;
use model::schedule::{ComputeRequest, ComputeOptions, ScheduleResult};
use tower_http::cors::CorsLayer;
use std::convert::Infallible;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};

/// Global slot for the LNS cancel token. Mono-user assumption (see
/// conversation-level decision): at most one background LNS runs at a
/// time, server-wide. When a new /compute-lns/stream connection opens,
/// the previous token is flipped to true so its LNS loop exits and the
/// new one is installed here.
fn lns_cancel_slot() -> &'static Mutex<Option<Arc<AtomicBool>>> {
    static SLOT: OnceLock<Mutex<Option<Arc<AtomicBool>>>> = OnceLock::new();
    SLOT.get_or_init(|| Mutex::new(None))
}

fn install_cancel_token() -> Arc<AtomicBool> {
    let new_token = Arc::new(AtomicBool::new(false));
    let slot = lns_cancel_slot();
    let mut guard = slot.lock().unwrap();
    if let Some(prev) = guard.take() {
        prev.store(true, Ordering::Relaxed);
    }
    *guard = Some(new_token.clone());
    new_token
}

async fn compute_schedule(Json(request): Json<ComputeRequest>) -> Json<ScheduleResult> {
    let result = engine::compute(&request);
    Json(result)
}

/// Two-phase compute — Phase 1 "fast" endpoint.
///
/// Runs base placement (FBI + Moore) but deliberately skips LNS so the
/// response comes back as soon as possible. The caller is expected to
/// kick off /compute-lns/stream separately for the 60 s background
/// improvement pass, seeded with the same request payload.
async fn compute_schedule_fast(
    Json(mut request): Json<ComputeRequest>,
) -> Json<ScheduleResult> {
    let mut options = request.options.clone().unwrap_or_default();
    options.skip_lns = Some(true);
    request.options = Some(options);
    let result = engine::compute(&request);
    Json(result)
}

async fn compute_schedule_stream(
    Json(request): Json<ComputeRequest>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let (tx, rx) = std::sync::mpsc::channel();

    // Run compute in a blocking thread (it's CPU-bound)
    let handle = tokio::task::spawn_blocking(move || {
        engine::compute_with_progress(&request, tx)
    });

    // Convert mpsc receiver into an async SSE stream
    let stream = async_stream::stream! {
        // Drain progress events from the channel
        loop {
            match rx.try_recv() {
                Ok(event) => {
                    let json = serde_json::to_string(&event).unwrap_or_default();
                    yield Ok(Event::default().event("progress").data(json));
                }
                Err(std::sync::mpsc::TryRecvError::Empty) => {
                    // Check if compute is done
                    if handle.is_finished() {
                        // Drain remaining events
                        while let Ok(event) = rx.try_recv() {
                            let json = serde_json::to_string(&event).unwrap_or_default();
                            yield Ok(Event::default().event("progress").data(json));
                        }
                        break;
                    }
                    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                }
                Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
            }
        }

        // Send the final result
        match handle.await {
            Ok(result) => {
                let json = serde_json::to_string(&result).unwrap_or_default();
                yield Ok(Event::default().event("result").data(json));
            }
            Err(e) => {
                let err = format!("{{\"error\":\"{}\"}}", e);
                yield Ok(Event::default().event("error").data(err));
            }
        }
    };

    Sse::new(stream)
}

/// Two-phase compute — Phase 2 "background LNS" SSE stream.
///
/// Forces skip_lns=false with a 60 s default LNS budget, forwards progress
/// events as SSE, and installs a global cancel token so a superseding
/// request can cancel this one cleanly. Assumes mono-user deployment:
/// at most one LNS runs server-wide at a time.
async fn compute_schedule_lns_stream(
    Json(mut request): Json<ComputeRequest>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let mut options = request.options.clone().unwrap_or_else(ComputeOptions::default);
    options.skip_lns = Some(false);
    if options.lns_budget_ms.is_none() {
        options.lns_budget_ms = Some(60_000);
    }
    request.options = Some(options);

    let (tx, rx) = std::sync::mpsc::channel();
    let cancel = install_cancel_token();
    let cancel_for_task = cancel.clone();

    let handle = tokio::task::spawn_blocking(move || {
        engine::compute_with_cancel(&request, tx, cancel_for_task)
    });

    let stream = async_stream::stream! {
        loop {
            match rx.try_recv() {
                Ok(event) => {
                    let json = serde_json::to_string(&event).unwrap_or_default();
                    yield Ok(Event::default().event("progress").data(json));
                }
                Err(std::sync::mpsc::TryRecvError::Empty) => {
                    if handle.is_finished() {
                        while let Ok(event) = rx.try_recv() {
                            let json = serde_json::to_string(&event).unwrap_or_default();
                            yield Ok(Event::default().event("progress").data(json));
                        }
                        break;
                    }
                    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
                }
                Err(std::sync::mpsc::TryRecvError::Disconnected) => break,
            }
        }

        match handle.await {
            Ok(result) => {
                let json = serde_json::to_string(&result).unwrap_or_default();
                yield Ok(Event::default().event("result").data(json));
            }
            Err(e) => {
                let err = format!("{{\"error\":\"{}\"}}", e);
                yield Ok(Event::default().event("error").data(err));
            }
        }
        // Clear the slot only if it still holds our token — a newer
        // request may have already swapped it.
        let slot = lns_cancel_slot();
        if let Ok(mut guard) = slot.lock() {
            if let Some(current) = guard.as_ref() {
                if Arc::ptr_eq(current, &cancel) {
                    guard.take();
                }
            }
        }
    };

    Sse::new(stream)
}

#[tokio::main]
async fn main() {
    let cors = CorsLayer::permissive();
    let app = Router::new()
        .route("/compute", post(compute_schedule))
        .route("/compute-fast", post(compute_schedule_fast))
        .route("/compute-stream", post(compute_schedule_stream))
        .route("/compute-lns/stream", post(compute_schedule_lns_stream))
        .layer(cors);
    let port = std::env::var("PORT").unwrap_or_else(|_| "3003".to_string());
    let addr = format!("0.0.0.0:{}", port);
    println!("Flux Scheduler Engine listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
