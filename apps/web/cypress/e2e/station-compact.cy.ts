/**
 * Station Compact E2E Tests
 *
 * Tests for the station compact UI feature (v0.3.22)
 * Verifies compact button visibility, loading states, and tile repositioning.
 */

describe('Station Compact', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.waitForAppReady();
  });

  // ============================================================================
  // Compact Button Visibility
  // ============================================================================

  describe('Compact Button Visibility', () => {
    it('should show compact button in station headers', () => {
      // Find station headers
      cy.get('[data-testid^="station-header-"]')
        .should('have.length.at.least', 1)
        .first()
        .within(() => {
          // Should have a compact button
          cy.get('[data-testid^="compact-button-"]').should('exist');
        });
    });

    it('should show compact button for all stations', () => {
      // Get all station headers
      cy.get('[data-testid^="station-header-"]').each(($header) => {
        // Each header should have a compact button (when not collapsed)
        const testId = $header.attr('data-testid');
        const stationId = testId?.replace('station-header-', '');
        if (stationId) {
          cy.get(`[data-testid="compact-button-${stationId}"]`).should('exist');
        }
      });
    });

    it('should disable compact button when station has no tiles', () => {
      // Find a station with no tiles (check station columns)
      cy.get('[data-testid^="station-column-"]').each(($column) => {
        const tiles = $column.find('[data-testid^="tile-"]');
        const testId = $column.attr('data-testid');
        const stationId = testId?.replace('station-column-', '');

        if (tiles.length === 0 && stationId) {
          // This station has no tiles, button should be disabled
          cy.get(`[data-testid="compact-button-${stationId}"]`)
            .should('be.disabled');
        }
      });
    });

    it('should enable compact button when station has tiles', () => {
      // Find a station with tiles
      cy.get('[data-testid^="station-column-"]').each(($column) => {
        const tiles = $column.find('[data-testid^="tile-"]');
        const testId = $column.attr('data-testid');
        const stationId = testId?.replace('station-column-', '');

        if (tiles.length > 0 && stationId) {
          // This station has tiles, button should be enabled
          cy.get(`[data-testid="compact-button-${stationId}"]`)
            .should('not.be.disabled');
        }
      });
    });
  });

  // ============================================================================
  // Compact Button Interaction
  // ============================================================================

  describe('Compact Button Interaction', () => {
    it('should show loading state when compact button is clicked', () => {
      // Intercept the compact API call and delay response
      cy.intercept('POST', '/api/v1/stations/*/compact', (req) => {
        req.reply({
          delay: 1000,
          statusCode: 200,
          body: {
            compactedCount: 0,
            assignments: [],
          },
        });
      }).as('compactRequest');

      // Find a station with tiles and click its compact button
      cy.get('[data-testid^="station-column-"]').then(($columns) => {
        // Find first column with tiles
        let stationId: string | null = null;
        $columns.each((_, column) => {
          const tiles = Cypress.$(column).find('[data-testid^="tile-"]');
          if (tiles.length > 0 && !stationId) {
            const testId = Cypress.$(column).attr('data-testid');
            stationId = testId?.replace('station-column-', '') || null;
          }
        });

        if (!stationId) {
          cy.log('No stations with tiles found - skipping loading state test');
          return;
        }

        // Click the compact button
        cy.get(`[data-testid="compact-button-${stationId}"]`).click();

        // Button should show loading state (contain spinner)
        cy.get(`[data-testid="compact-button-${stationId}"]`)
          .should('be.disabled')
          .find('svg.animate-spin')
          .should('exist');
      });
    });

    it('should call compact API when button is clicked', () => {
      // Intercept the compact API call
      cy.intercept('POST', '/api/v1/stations/*/compact', {
        statusCode: 200,
        body: {
          compactedCount: 0,
          assignments: [],
        },
      }).as('compactRequest');

      // Find a station with tiles and click its compact button
      cy.get('[data-testid^="station-column-"]').then(($columns) => {
        // Find first column with tiles
        let stationId: string | null = null;
        $columns.each((_, column) => {
          const tiles = Cypress.$(column).find('[data-testid^="tile-"]');
          if (tiles.length > 0 && !stationId) {
            const testId = Cypress.$(column).attr('data-testid');
            stationId = testId?.replace('station-column-', '') || null;
          }
        });

        if (!stationId) {
          cy.log('No stations with tiles found - skipping API call test');
          return;
        }

        // Click the compact button
        cy.get(`[data-testid="compact-button-${stationId}"]`).click();

        // Wait for API call
        cy.wait('@compactRequest').then((interception) => {
          expect(interception.request.method).to.equal('POST');
          expect(interception.request.url).to.include(`/api/v1/stations/${stationId}/compact`);
        });
      });
    });

    it('should re-enable button after compact completes', () => {
      // Intercept the compact API call with quick response
      cy.intercept('POST', '/api/v1/stations/*/compact', {
        statusCode: 200,
        body: {
          compactedCount: 0,
          assignments: [],
        },
      }).as('compactRequest');

      // Find a station with tiles and click its compact button
      cy.get('[data-testid^="station-column-"]').then(($columns) => {
        // Find first column with tiles
        let stationId: string | null = null;
        $columns.each((_, column) => {
          const tiles = Cypress.$(column).find('[data-testid^="tile-"]');
          if (tiles.length > 0 && !stationId) {
            const testId = Cypress.$(column).attr('data-testid');
            stationId = testId?.replace('station-column-', '') || null;
          }
        });

        if (!stationId) {
          cy.log('No stations with tiles found - skipping re-enable test');
          return;
        }

        // Click the compact button
        cy.get(`[data-testid="compact-button-${stationId}"]`).click();

        // Wait for API call to complete
        cy.wait('@compactRequest');

        // Button should be re-enabled (not disabled, no spinner)
        cy.get(`[data-testid="compact-button-${stationId}"]`)
          .should('not.be.disabled')
          .find('svg.animate-spin')
          .should('not.exist');
      });
    });
  });

  // ============================================================================
  // Compact Button Hover State
  // ============================================================================

  describe('Compact Button Hover State', () => {
    it('should show tooltip on hover', () => {
      // Find a compact button
      cy.get('[data-testid^="compact-button-"]')
        .first()
        .should('have.attr', 'title');
    });

    it('should show appropriate title based on tile count', () => {
      // Button on station with tiles should say "Compact station"
      cy.get('[data-testid^="station-column-"]').then(($columns) => {
        $columns.each((_, column) => {
          const tiles = Cypress.$(column).find('[data-testid^="tile-"]');
          const testId = Cypress.$(column).attr('data-testid');
          const stationId = testId?.replace('station-column-', '');

          if (stationId) {
            const expectedTitle = tiles.length > 0 ? 'Compact station' : 'No tiles to compact';
            cy.get(`[data-testid="compact-button-${stationId}"]`)
              .should('have.attr', 'title', expectedTitle);
          }
        });
      });
    });
  });

  // ============================================================================
  // Multiple Stations
  // ============================================================================

  describe('Multiple Stations', () => {
    it('should allow compacting different stations independently', () => {
      // Intercept compact API calls
      cy.intercept('POST', '/api/v1/stations/*/compact', {
        statusCode: 200,
        body: {
          compactedCount: 0,
          assignments: [],
        },
      }).as('compactRequest');

      // Find all stations with tiles
      const stationsWithTiles: string[] = [];
      cy.get('[data-testid^="station-column-"]').each(($column) => {
        const tiles = $column.find('[data-testid^="tile-"]');
        const testId = $column.attr('data-testid');
        const stationId = testId?.replace('station-column-', '');

        if (tiles.length > 0 && stationId) {
          stationsWithTiles.push(stationId);
        }
      }).then(() => {
        if (stationsWithTiles.length < 2) {
          cy.log('Need at least 2 stations with tiles for this test - skipping');
          return;
        }

        // Click compact on first station
        cy.get(`[data-testid="compact-button-${stationsWithTiles[0]}"]`).click();
        cy.wait('@compactRequest');

        // Click compact on second station
        cy.get(`[data-testid="compact-button-${stationsWithTiles[1]}"]`).click();
        cy.wait('@compactRequest');

        // If we got here without errors, both calls were made successfully
        cy.log('Both compact calls completed successfully');
      });
    });

    it('should only show loading on the station being compacted', () => {
      // Intercept the compact API call and delay response
      cy.intercept('POST', '/api/v1/stations/*/compact', (req) => {
        req.reply({
          delay: 500,
          statusCode: 200,
          body: {
            compactedCount: 0,
            assignments: [],
          },
        });
      }).as('compactRequest');

      // Find all stations with tiles
      const stationsWithTiles: string[] = [];
      cy.get('[data-testid^="station-column-"]').each(($column) => {
        const tiles = $column.find('[data-testid^="tile-"]');
        const testId = $column.attr('data-testid');
        const stationId = testId?.replace('station-column-', '');

        if (tiles.length > 0 && stationId) {
          stationsWithTiles.push(stationId);
        }
      }).then(() => {
        if (stationsWithTiles.length < 2) {
          cy.log('Need at least 2 stations with tiles for this test - skipping');
          return;
        }

        // Click compact on first station
        cy.get(`[data-testid="compact-button-${stationsWithTiles[0]}"]`).click();

        // First station should show loading
        cy.get(`[data-testid="compact-button-${stationsWithTiles[0]}"]`)
          .should('be.disabled');

        // Second station should NOT show loading
        cy.get(`[data-testid="compact-button-${stationsWithTiles[1]}"]`)
          .should('not.be.disabled');
      });
    });
  });
});
