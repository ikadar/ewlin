/**
 * Template CRUD E2E Tests
 *
 * Tests for v0.4.34 - JCF: Template CRUD & Apply
 *
 * Tests cover:
 * - Create template from job elements
 * - Apply template to new job
 * - Template validation
 * - Keyboard shortcuts (Cmd+S, Esc)
 */

describe('JCF Template CRUD', () => {
  beforeEach(() => {
    // Clear localStorage templates before each test
    cy.window().then((win) => {
      win.localStorage.removeItem('flux-jcf-templates');
    });
    cy.visit('/');
    cy.waitForAppReady();
  });

  // ============================================================================
  // JCF Modal Opening
  // ============================================================================

  describe('JCF Modal', () => {
    it('should open JCF modal when clicking + Nouveau job button', () => {
      // Find and click the "Nouveau job" button
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // JCF modal should be visible
      cy.get('[data-testid="jcf-modal-backdrop"]').should('be.visible');
      cy.get('[data-testid="jcf-modal-dialog"]').should('be.visible');
    });

    it('should close JCF modal when clicking close button', () => {
      // Open modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      cy.get('[data-testid="jcf-modal-backdrop"]').should('be.visible');

      // Click close button
      cy.get('[data-testid="jcf-modal-close"]').click();

      // Modal should be closed
      cy.get('[data-testid="jcf-modal-backdrop"]').should('not.exist');
    });

    it('should close JCF modal when pressing Escape', () => {
      // Open modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      cy.get('[data-testid="jcf-modal-backdrop"]').should('be.visible');

      // Press Escape
      cy.get('body').type('{esc}');

      // Modal should be closed
      cy.get('[data-testid="jcf-modal-backdrop"]').should('not.exist');
    });
  });

  // ============================================================================
  // Save as Template
  // ============================================================================

  describe('Save as Template', () => {
    it('should show Save as Template button in JCF modal footer', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Save as Template button should be visible
      cy.get('[data-testid="jcf-save-as-template"]').should('be.visible');
    });

    it('should open template editor when clicking Save as Template', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Add an element name first (required for valid template)
      cy.get('[data-testid="jcf-element-row-0"]')
        .find('[data-testid="element-field-name"]')
        .type('COUV');

      // Click Save as Template
      cy.get('[data-testid="jcf-save-as-template"]').click();

      // Template editor modal should open
      cy.get('[data-testid="template-editor-backdrop"]').should('be.visible');
      cy.get('[data-testid="template-editor-dialog"]').should('be.visible');
    });

    it('should show validation error when saving template without name', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Add an element
      cy.get('[data-testid="jcf-element-row-0"]')
        .find('[data-testid="element-field-name"]')
        .type('COUV');

      // Open template editor
      cy.get('[data-testid="jcf-save-as-template"]').click();

      cy.get('[data-testid="template-editor-backdrop"]').should('be.visible');

      // Try to save without name
      cy.get('[data-testid="template-editor-save"]').click();

      // Should show validation error
      cy.contains('Le nom du template est obligatoire').should('be.visible');
    });

    it('should create template successfully with valid data', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Add an element
      cy.get('[data-testid="jcf-element-row-0"]')
        .find('[data-testid="element-field-name"]')
        .type('COUV');

      // Open template editor
      cy.get('[data-testid="jcf-save-as-template"]').click();

      // Fill in template name
      cy.get('[data-testid="template-field-name"]').type('Test Template E2E');

      // Fill in description
      cy.get('[data-testid="template-field-description"]').type('Template created by E2E test');

      // Save
      cy.get('[data-testid="template-editor-save"]').click();

      // Template editor should close
      cy.get('[data-testid="template-editor-backdrop"]').should('not.exist');

      // Verify template was saved to localStorage
      cy.window().then((win) => {
        const templates = JSON.parse(win.localStorage.getItem('flux-jcf-templates') || '[]');
        const createdTemplate = templates.find((t: { name: string }) => t.name === 'Test Template E2E');
        expect(createdTemplate).to.exist;
        expect(createdTemplate.description).to.equal('Template created by E2E test');
        expect(createdTemplate.elements).to.have.length(1);
        expect(createdTemplate.elements[0].name).to.equal('COUV');
      });
    });

    it('should close template editor when pressing Escape', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Add an element
      cy.get('[data-testid="jcf-element-row-0"]')
        .find('[data-testid="element-field-name"]')
        .type('COUV');

      // Open template editor
      cy.get('[data-testid="jcf-save-as-template"]').click();

      cy.get('[data-testid="template-editor-backdrop"]').should('be.visible');

      // Press Escape
      cy.get('body').type('{esc}');

      // Template editor should close
      cy.get('[data-testid="template-editor-backdrop"]').should('not.exist');

      // JCF modal should still be open
      cy.get('[data-testid="jcf-modal-backdrop"]').should('be.visible');
    });

    it('should close template editor when clicking Cancel', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Add an element
      cy.get('[data-testid="jcf-element-row-0"]')
        .find('[data-testid="element-field-name"]')
        .type('COUV');

      // Open template editor
      cy.get('[data-testid="jcf-save-as-template"]').click();

      cy.get('[data-testid="template-editor-backdrop"]').should('be.visible');

      // Click Cancel
      cy.get('[data-testid="template-editor-cancel"]').click();

      // Template editor should close
      cy.get('[data-testid="template-editor-backdrop"]').should('not.exist');

      // JCF modal should still be open
      cy.get('[data-testid="jcf-modal-backdrop"]').should('be.visible');
    });
  });

  // ============================================================================
  // Apply Template
  // ============================================================================

  describe('Apply Template', () => {
    beforeEach(() => {
      // Seed a template in localStorage before each apply test
      cy.window().then((win) => {
        const seedTemplate = {
          id: 'tpl-e2e-seed',
          name: 'E2E Seed Template',
          description: 'Template for E2E testing',
          category: 'Brochure',
          elements: [
            {
              name: 'COUV',
              precedences: '',
              quantite: '1',
              format: 'A4f',
              pagination: '4',
              papier: 'Couché mat 250g',
              imposition: '50x70(8)',
              impression: 'Q/Q',
              surfacage: 'mat/',
              autres: '',
              qteFeuilles: '',
              commentaires: '',
              sequence: '',
            },
            {
              name: 'INT',
              precedences: '',
              quantite: '1',
              format: 'A4f',
              pagination: '16',
              papier: 'Couché mat 135g',
              imposition: '50x70(16)',
              impression: 'Q/Q',
              surfacage: '',
              autres: '',
              qteFeuilles: '',
              commentaires: '',
              sequence: '',
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        win.localStorage.setItem('flux-jcf-templates', JSON.stringify([seedTemplate]));
      });
    });

    it('should show template in autocomplete dropdown', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Focus template field and type to search
      cy.get('#jcf-template').click().type('E2E');

      // Wait for autocomplete dropdown
      cy.wait(200);

      // Should show the seeded template in suggestions
      cy.contains('E2E Seed Template').should('be.visible');
    });

    it('should populate elements table when selecting template', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Focus template field and type to search
      cy.get('#jcf-template').click().type('E2E');

      // Wait for autocomplete
      cy.wait(200);

      // Select the template
      cy.contains('E2E Seed Template').click();

      // Wait for elements to populate
      cy.wait(300);

      // Check that elements were populated
      cy.get('[data-testid="jcf-element-row-0"]')
        .find('[data-testid="element-field-name"]')
        .should('have.value', 'COUV');

      cy.get('[data-testid="jcf-element-row-1"]')
        .find('[data-testid="element-field-name"]')
        .should('have.value', 'INT');

      // Check that format was populated
      cy.get('[data-testid="jcf-element-row-0"]')
        .find('[data-testid="element-field-format"]')
        .should('have.value', 'A4f');
    });
  });

  // ============================================================================
  // Template Editor Keyboard Shortcuts
  // ============================================================================

  describe('Template Editor Keyboard Shortcuts', () => {
    it('should save with Cmd+S when form is valid', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Add an element
      cy.get('[data-testid="jcf-element-row-0"]')
        .find('[data-testid="element-field-name"]')
        .type('COUV');

      // Open template editor
      cy.get('[data-testid="jcf-save-as-template"]').click();

      // Fill in template name
      cy.get('[data-testid="template-field-name"]').type('Keyboard Save Test');

      // Press Cmd+S (or Ctrl+S on Windows/Linux)
      cy.get('body').type('{meta}s');

      // Template editor should close (saved successfully)
      cy.get('[data-testid="template-editor-backdrop"]').should('not.exist');

      // Verify template was saved
      cy.window().then((win) => {
        const templates = JSON.parse(win.localStorage.getItem('flux-jcf-templates') || '[]');
        const savedTemplate = templates.find((t: { name: string }) => t.name === 'Keyboard Save Test');
        expect(savedTemplate).to.exist;
      });
    });
  });

  // ============================================================================
  // Template Elements Validation
  // ============================================================================

  describe('Template Validation', () => {
    it('should show error when saving without elements', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Open template editor without adding any elements
      // Note: Save as Template button might be disabled if no valid elements
      // Let's check if it's enabled first
      cy.get('[data-testid="jcf-save-as-template"]').then(($btn) => {
        if ($btn.is(':disabled')) {
          // Button is disabled when no valid elements - this is expected behavior
          cy.log('Save as Template button correctly disabled when no valid elements');
        } else {
          // If button is enabled, clicking it should show validation error
          cy.wrap($btn).click();
          cy.get('[data-testid="template-field-name"]').type('Empty Template');
          cy.get('[data-testid="template-editor-save"]').click();
          cy.contains('au moins un élément').should('be.visible');
        }
      });
    });
  });

  // ============================================================================
  // Template with Pre-filled Client
  // ============================================================================

  describe('Template with Client', () => {
    it('should pre-fill client name in template editor from JCF', () => {
      // Open JCF modal
      cy.get('[data-testid="jobs-list"]')
        .find('button')
        .contains('Nouveau')
        .click();

      // Set client
      cy.get('#jcf-client').type('Test Client Name');

      // Add an element
      cy.get('[data-testid="jcf-element-row-0"]')
        .find('[data-testid="element-field-name"]')
        .type('COUV');

      // Open template editor
      cy.get('[data-testid="jcf-save-as-template"]').click();

      // Client field should be pre-filled
      cy.get('[data-testid="template-field-client"]')
        .should('have.value', 'Test Client Name');
    });
  });
});
