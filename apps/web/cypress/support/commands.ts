// ***********************************************
// Custom Cypress commands for Flux Scheduler
// ***********************************************

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Select a job by its reference in the jobs list
       */
      selectJob(reference: string): Chainable<JQuery<HTMLElement>>;

      /**
       * Get the scheduling grid element
       */
      getSchedulingGrid(): Chainable<JQuery<HTMLElement>>;

      /**
       * Get a task tile in the Job Details Panel by task ID
       */
      getTaskTile(taskId: string): Chainable<JQuery<HTMLElement>>;

      /**
       * Get the grid's current scroll position
       */
      getGridScrollPosition(): Chainable<{ x: number; y: number }>;

      /**
       * Wait for the app to be fully loaded
       */
      waitForAppReady(): Chainable<void>;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

// Select a job by clicking on its card in the jobs list
Cypress.Commands.add('selectJob', (reference: string) => {
  return cy.get('[data-testid="jobs-list"]')
    .contains(reference)
    .click();
});

// Get the scheduling grid
Cypress.Commands.add('getSchedulingGrid', () => {
  return cy.get('[data-testid="scheduling-grid"]');
});

// Get a task tile by its ID
Cypress.Commands.add('getTaskTile', (taskId: string) => {
  return cy.get(`[data-testid="task-tile-${taskId}"]`);
});

// Get the grid's scroll position
Cypress.Commands.add('getGridScrollPosition', () => {
  return cy.getSchedulingGrid().then(($grid) => {
    const element = $grid[0];
    return {
      x: element.scrollLeft,
      y: element.scrollTop,
    };
  });
});

// Wait for the app to be ready (mock data loaded)
Cypress.Commands.add('waitForAppReady', () => {
  // Wait for the scheduling grid to be visible
  cy.getSchedulingGrid().should('be.visible');
  // Wait for at least one job to appear in the list
  cy.get('[data-testid="jobs-list"]').should('exist');
});

export {};
