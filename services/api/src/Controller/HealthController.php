<?php

declare(strict_types=1);

namespace App\Controller;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Health check endpoints for container orchestration and monitoring.
 */
class HealthController extends AbstractController
{
    public function __construct(
        private readonly Connection $connection,
    ) {
    }

    /**
     * Basic health check - returns 200 if the application is running.
     * Used by Nginx and container health checks.
     */
    #[Route('/health', name: 'health', methods: ['GET'])]
    public function health(): Response
    {
        return new Response('OK', Response::HTTP_OK);
    }

    /**
     * Detailed health check with service status.
     * Returns JSON with status of each component.
     */
    #[Route('/health/details', name: 'health_details', methods: ['GET'])]
    public function healthDetails(): JsonResponse
    {
        $status = [
            'status' => 'healthy',
            'timestamp' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
            'version' => '0.0.2',
            'services' => [
                'php' => $this->checkPhp(),
                'database' => $this->checkDatabase(),
            ],
        ];

        $httpStatus = Response::HTTP_OK;
        foreach ($status['services'] as $service) {
            if ($service['status'] !== 'healthy') {
                $status['status'] = 'unhealthy';
                $httpStatus = Response::HTTP_SERVICE_UNAVAILABLE;
                break;
            }
        }

        return new JsonResponse($status, $httpStatus);
    }

    private function checkPhp(): array
    {
        return [
            'status' => 'healthy',
            'version' => PHP_VERSION,
            'extensions' => [
                'pdo_mysql' => extension_loaded('pdo_mysql'),
                'redis' => extension_loaded('redis'),
                'intl' => extension_loaded('intl'),
            ],
        ];
    }

    private function checkDatabase(): array
    {
        try {
            $this->connection->executeQuery('SELECT 1');
            return [
                'status' => 'healthy',
                'driver' => $this->connection->getDriver()::class,
            ];
        } catch (\Throwable $e) {
            return [
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
            ];
        }
    }
}
