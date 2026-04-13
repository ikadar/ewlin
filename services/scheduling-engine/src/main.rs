mod engine;
mod model;

use axum::{
    routing::post,
    response::sse::{Event, Sse},
    Json, Router,
};
use futures::stream::Stream;
use model::schedule::{ComputeRequest, ScheduleResult};
use tower_http::cors::CorsLayer;
use std::convert::Infallible;

async fn compute_schedule(Json(request): Json<ComputeRequest>) -> Json<ScheduleResult> {
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

#[tokio::main]
async fn main() {
    let cors = CorsLayer::permissive();
    let app = Router::new()
        .route("/compute", post(compute_schedule))
        .route("/compute-stream", post(compute_schedule_stream))
        .layer(cors);
    let port = std::env::var("PORT").unwrap_or_else(|_| "3003".to_string());
    let addr = format!("0.0.0.0:{}", port);
    println!("Flux Scheduler Engine listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
