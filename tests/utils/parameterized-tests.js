/**
 * Parameterized Test Helpers
 *
 * @module tests/utils/parameterized-tests
 * @description Utilities for creating parameterized tests to eliminate duplication
 *
 * Provides patterns for testing multiple scenarios with the same test logic:
 * - Scenario-based testing (arrays of test cases)
 * - Matrix testing (combinations of inputs)
 * - Data-driven testing (CSV-like test data)
 *
 * @upstream Called by: Test files with repetitive test patterns
 * @downstream Calls: Vitest describe/it functions
 *
 * @usage
 * import { describeScenarios, matrixTest } from '../utils/parameterized-tests';
 *
 * describeScenarios('Action parsing', parsingScenarios, (scenario) => {
 *   // Test logic here - runs for each scenario
 * });
 */

// ============================================================================
// SCENARIO-BASED TESTING
// ============================================================================

/**
 * Create parameterized tests from an array of scenarios
 *
 * @param {string} groupName - Test group name
 * @param {Array} scenarios - Array of test scenarios
 * @param {Function} testFn - Test function that receives each scenario
 * @param {Object} options - Test options
 *
 * @example
 * const scenarios = [
 *   { name: 'valid json', input: '[...]', expectSuccess: true },
 *   { name: 'malformed', input: '{...}', expectSuccess: false }
 * ];
 *
 * describeScenarios('JSON parsing', scenarios, (scenario) => {
 *   const result = parseJson(scenario.input);
 *   expect(result.success).toBe(scenario.expectSuccess);
 * });
 */
export function describeScenarios(groupName, scenarios, testFn, options = {}) {
  const { skip, only, timeout } = options;

  const describeFn = skip ? describe.skip :
                     only ? describe.only :
                     describe;

  describeFn(groupName, () => {
    scenarios.forEach((scenario, index) => {
      const testName = scenario.name || `Scenario ${index + 1}`;
      const testOptions = timeout ? { timeout } : {};

      const testFnWrapped = async () => {
        try {
          await testFn(scenario, index);
        } catch (error) {
          // Add scenario context to error message
          const scenarioInfo = JSON.stringify(scenario, null, 2);
          error.message += `\n\nScenario context:\n${scenarioInfo}`;
          throw error;
        }
      };

      if (timeout) {
        it(testName, testFnWrapped, { timeout });
      } else {
        it(testName, testFnWrapped);
      }
    });
  });
}

/**
 * Create focused scenario tests (describe.only equivalent)
 *
 * @param {string} groupName - Test group name
 * @param {Array} scenarios - Array of test scenarios
 * @param {Function} testFn - Test function
 */
export function describeScenariosOnly(groupName, scenarios, testFn) {
  describeScenarios(groupName, scenarios, testFn, { only: true });
}

/**
 * Create skipped scenario tests (describe.skip equivalent)
 *
 * @param {string} groupName - Test group name
 * @param {Array} scenarios - Array of test scenarios
 * @param {Function} testFn - Test function
 */
export function describeScenariosSkip(groupName, scenarios, testFn) {
  describeScenarios(groupName, scenarios, testFn, { skip: true });
}

// ============================================================================
// MATRIX TESTING
// ============================================================================

/**
 * Create tests for all combinations of input parameters
 *
 * @param {string} testName - Base test name
 * @param {Object} dimensions - Object with arrays of values for each dimension
 * @param {Function} testFn - Test function receiving combination object
 *
 * @example
 * matrixTest('validate input', {
 *   type: ['string', 'number', 'boolean'],
 *   required: [true, false],
 *   nullable: [true, false]
 * }, ({ type, required, nullable }) => {
 *   const schema = { type, required, nullable };
 *   expect(isValidSchema(schema)).toBe(true);
 * });
 */
export function matrixTest(testName, dimensions, testFn) {
  const combinations = generateCombinations(dimensions);

  describe(`${testName} (matrix)`, () => {
    combinations.forEach((combination, index) => {
      const combinationName = Object.entries(combination)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');

      it(`${testName} [${combinationName}]`, async () => {
        await testFn(combination, index);
      });
    });
  });
}

/**
 * Generate all combinations of dimension values
 *
 * @param {Object} dimensions - Object with arrays of values
 * @returns {Array} Array of combination objects
 */
function generateCombinations(dimensions) {
  const dimensionKeys = Object.keys(dimensions);
  const dimensionValues = Object.values(dimensions);

  if (dimensionKeys.length === 0) return [{}];

  const combinations = [];

  function generate(current, index) {
    if (index === dimensionKeys.length) {
      combinations.push({ ...current });
      return;
    }

    const key = dimensionKeys[index];
    const values = dimensionValues[index];

    for (const value of values) {
      current[key] = value;
      generate(current, index + 1);
    }
  }

  generate({}, 0);
  return combinations;
}

// ============================================================================
// CONDITIONAL TESTING
// ============================================================================

/**
 * Run tests only when certain conditions are met
 *
 * @param {string} testName - Test name
 * @param {Function} conditionFn - Function that returns true if test should run
 * @param {Function} testFn - Test function
 */
export function conditionalTest(testName, conditionFn, testFn) {
  if (conditionFn()) {
    it(testName, testFn);
  } else {
    it.skip(`${testName} (skipped: condition not met)`, testFn);
  }
}

/**
 * Run tests only in certain environments
 *
 * @param {string} testName - Test name
 * @param {Array} environments - Array of allowed environments
 * @param {Function} testFn - Test function
 */
export function environmentTest(testName, environments, testFn) {
  const currentEnv = process.env.NODE_ENV || 'test';

  conditionalTest(
    testName,
    () => environments.includes(currentEnv),
    testFn
  );
}

// ============================================================================
// DATA-DRIVEN TESTING
// ============================================================================

/**
 * Create tests from CSV-like data strings
 *
 * @param {string} testName - Base test name
 * @param {string} csvData - CSV data string
 * @param {Function} testFn - Test function receiving parsed row data
 *
 * @example
 * const csvData = `
 * input,expected
 * "hello",5
 * "world",5
 * "!",1
 * `;
 *
 * csvTest('string length', csvData, ({ input, expected }) => {
 *   expect(input.length).toBe(parseInt(expected));
 * });
 */
export function csvTest(testName, csvData, testFn) {
  const rows = parseCsvData(csvData);

  describe(`${testName} (CSV)`, () => {
    rows.forEach((row, index) => {
      const testDescription = Object.entries(row)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');

      it(`${testName} [${testDescription}]`, async () => {
        await testFn(row, index);
      });
    });
  });
}

/**
 * Parse CSV-like data string into array of objects
 *
 * @param {string} csvData - CSV data string
 * @returns {Array} Array of row objects
 */
function parseCsvData(csvData) {
  const lines = csvData.trim().split('\n').map(line => line.trim()).filter(line => line);
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    return row;
  });

  return rows;
}

// ============================================================================
// ASYNC TESTING HELPERS
// ============================================================================

/**
 * Test async operations with timeout
 *
 * @param {string} testName - Test name
 * @param {Function} asyncFn - Async function to test
 * @param {number} timeoutMs - Timeout in milliseconds
 */
export function asyncTest(testName, asyncFn, timeoutMs = 5000) {
  it(testName, async () => {
    await Promise.race([
      asyncFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Test timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }, timeoutMs);
}

/**
 * Test that an async operation completes within time limit
 *
 * @param {string} testName - Test name
 * @param {Function} asyncFn - Async function to test
 * @param {number} maxTimeMs - Maximum allowed time
 */
export function performanceTest(testName, asyncFn, maxTimeMs) {
  it(`${testName} (performance)`, async () => {
    const startTime = Date.now();
    await asyncFn();
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(maxTimeMs);
  }, maxTimeMs * 2); // Give some buffer for test overhead
}

// ============================================================================
// TEST GENERATOR UTILITIES
// ============================================================================

/**
 * Generate test cases programmatically
 *
 * @param {string} pattern - Test name pattern (use {variable} placeholders)
 * @param {Object} variables - Object with arrays of values for each variable
 * @param {Function} testFn - Test function
 *
 * @example
 * generateTests('validate {type} input', {
 *   type: ['email', 'phone', 'url']
 * }, ({ type }) => {
 *   const validator = getValidator(type);
 *   expect(validator('valid@example.com')).toBe(true);
 * });
 */
export function generateTests(pattern, variables, testFn) {
  const combinations = generateCombinations(variables);

  combinations.forEach(combination => {
    const testName = pattern.replace(/{(\w+)}/g, (match, key) => combination[key]);
    it(testName, () => testFn(combination));
  });
}

/**
 * Create test factories for reusable test patterns
 *
 * @param {Function} testTemplate - Template function that returns test configuration
 * @returns {Function} Test factory function
 *
 * @example
 * const createApiTest = testFactory((endpoint) => ({
 *   name: `GET ${endpoint}`,
 *   setup: () => mockApi(endpoint),
 *   test: () => expect(fetch(endpoint)).toResolve()
 * }));
 *
 * createApiTest('/users');
 * createApiTest('/posts');
 */
export function testFactory(testTemplate) {
  return (...args) => {
    const config = testTemplate(...args);

    it(config.name, async () => {
      if (config.setup) await config.setup();
      await config.test();
      if (config.teardown) await config.teardown();
    });
  };
}
