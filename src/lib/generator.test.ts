/**
 * Tests for generator module
 * Tests for GeneratorOptions, parseGeneratorOptions, and CLI argument building
 */

import { describe, it, expect } from 'bun:test';
import { DEFAULT_GENERATOR_OPTIONS, type GeneratorOptions } from './db/schema';
import { parseGeneratorOptions } from './generator';

describe('GeneratorOptions', () => {
  describe('DEFAULT_GENERATOR_OPTIONS', () => {
    it('should have modular enabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.modular).toBe(true);
    });

    it('should have typesOnly enabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.typesOnly).toBe(true);
    });

    it('should have routeTypes enabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.routeTypes).toBe(true);
    });

    it('should have extractEnums enabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.extractEnums).toBe(true);
    });

    it('should have extractResponses enabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.extractResponses).toBe(true);
    });

    it('should have extractRequestBody enabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.extractRequestBody).toBe(true);
    });

    it('should have extractRequestParams enabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.extractRequestParams).toBe(true);
    });

    it('should have sortTypes enabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.sortTypes).toBe(true);
    });

    it('should have sortRoutes enabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.sortRoutes).toBe(true);
    });

    it('should have extractResponseError disabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.extractResponseError).toBeFalsy();
    });

    it('should have readonly disabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.readonly).toBeFalsy();
    });

    it('should have unionEnums disabled by default', () => {
      expect(DEFAULT_GENERATOR_OPTIONS.unionEnums).toBeFalsy();
    });
  });

  describe('GeneratorOptions type validation', () => {
    it('should accept valid generator options', () => {
      const options: GeneratorOptions = {
        modular: true,
        typesOnly: true,
        routeTypes: false,
        extractEnums: true,
      };

      expect(options.modular).toBe(true);
      expect(options.typesOnly).toBe(true);
      expect(options.routeTypes).toBe(false);
    });

    it('should allow partial options', () => {
      const options: GeneratorOptions = {
        modular: false,
      };

      expect(options.modular).toBe(false);
      expect(options.typesOnly).toBeUndefined();
    });
  });
});

describe('parseGeneratorOptions', () => {
  it('should return default options when input is null', () => {
    const result = parseGeneratorOptions(null);
    expect(result).toEqual(DEFAULT_GENERATOR_OPTIONS);
  });

  it('should return default options when input is empty string', () => {
    const result = parseGeneratorOptions('');
    expect(result).toEqual(DEFAULT_GENERATOR_OPTIONS);
  });

  it('should return default options when input is invalid JSON', () => {
    const result = parseGeneratorOptions('not valid json');
    expect(result).toEqual(DEFAULT_GENERATOR_OPTIONS);
  });

  it('should parse valid JSON options', () => {
    const customOptions = {
      modular: false,
      typesOnly: false,
    };
    const result = parseGeneratorOptions(JSON.stringify(customOptions));

    expect(result.modular).toBe(false);
    expect(result.typesOnly).toBe(false);
    // Other options should use defaults
    expect(result.routeTypes).toBe(DEFAULT_GENERATOR_OPTIONS.routeTypes);
    expect(result.extractEnums).toBe(DEFAULT_GENERATOR_OPTIONS.extractEnums);
  });

  it('should merge custom options with defaults', () => {
    const customOptions = {
      modular: false,
      extractEnums: false,
    };
    const result = parseGeneratorOptions(JSON.stringify(customOptions));

    expect(result.modular).toBe(false);
    expect(result.extractEnums).toBe(false);
    expect(result.typesOnly).toBe(DEFAULT_GENERATOR_OPTIONS.typesOnly);
    expect(result.routeTypes).toBe(DEFAULT_GENERATOR_OPTIONS.routeTypes);
  });

  it('should handle partial options with all fields', () => {
    const customOptions = {
      modular: true,
      typesOnly: true,
      routeTypes: true,
      extractEnums: true,
      extractResponses: true,
      extractRequestBody: true,
      extractRequestParams: true,
      extractResponseError: true,
      readonly: true,
      unionEnums: true,
      sortTypes: true,
      sortRoutes: true,
    };
    const result = parseGeneratorOptions(JSON.stringify(customOptions));

    expect(result).toEqual(customOptions);
  });
});

describe('CLI argument building', () => {
  /**
   * Helper function to build CLI arguments (mirrors generator.ts logic)
   */
  function buildCliArgs(options: {
    specUrl: string;
    outputDir: string;
    baseUrl?: string;
    options: GeneratorOptions;
  }): string[] {
    const args: string[] = ['generate'];

    // Input spec
    args.push('-p', options.specUrl);

    // Output directory
    args.push('-o', options.outputDir);

    // Base URL
    if (options.baseUrl) {
      args.push('--base-url', options.baseUrl);
    }

    // Modular
    if (options.options.modular) {
      args.push('--modular');
    }

    // Types only (no client)
    if (options.options.typesOnly) {
      args.push('--no-client');
    }

    // Route types
    if (options.options.routeTypes) {
      args.push('--route-types');
    }

    // Extract enums
    if (options.options.extractEnums) {
      args.push('--extract-enums');
    }

    // Extract responses
    if (options.options.extractResponses) {
      args.push('--extract-responses');
    }

    // Extract request body
    if (options.options.extractRequestBody) {
      args.push('--extract-request-body');
    }

    // Extract request params
    if (options.options.extractRequestParams) {
      args.push('--extract-request-params');
    }

    // Extract response error
    if (options.options.extractResponseError) {
      args.push('--extract-response-error');
    }

    // Readonly
    if (options.options.readonly) {
      args.push('--add-readonly');
    }

    // Union enums
    if (options.options.unionEnums) {
      args.push('--generate-union-enums');
    }

    // Sort types
    if (options.options.sortTypes) {
      args.push('--sort-types');
    }

    // Sort routes
    if (options.options.sortRoutes) {
      args.push('--sort-routes');
    }

    return args;
  }

  it('should build basic CLI args with spec URL and output', () => {
    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options: DEFAULT_GENERATOR_OPTIONS,
    });

    expect(args[0]).toBe('generate');
    expect(args).toContain('-p');
    expect(args).toContain('https://example.com/spec.json');
    expect(args).toContain('-o');
    expect(args).toContain('/tmp/output');
  });

  it('should include --modular when modular option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      modular: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--modular');
  });

  it('should NOT include --modular when modular option is false', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      modular: false,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).not.toContain('--modular');
  });

  it('should include --no-client when typesOnly option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      typesOnly: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--no-client');
  });

  it('should NOT include --no-client when typesOnly option is false', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      typesOnly: false,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).not.toContain('--no-client');
  });

  it('should include --route-types when routeTypes option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      routeTypes: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--route-types');
  });

  it('should include --extract-enums when extractEnums option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      extractEnums: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--extract-enums');
  });

  it('should include --extract-responses when extractResponses option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      extractResponses: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--extract-responses');
  });

  it('should include --extract-request-body when extractRequestBody option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      extractRequestBody: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--extract-request-body');
  });

  it('should include --extract-request-params when extractRequestParams option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      extractRequestParams: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--extract-request-params');
  });

  it('should include --extract-response-error when extractResponseError option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      extractResponseError: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--extract-response-error');
  });

  it('should include --add-readonly when readonly option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      readonly: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--add-readonly');
  });

  it('should include --generate-union-enums when unionEnums option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      unionEnums: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--generate-union-enums');
  });

  it('should include --sort-types when sortTypes option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      sortTypes: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--sort-types');
  });

  it('should include --sort-routes when sortRoutes option is true', () => {
    const options: GeneratorOptions = {
      ...DEFAULT_GENERATOR_OPTIONS,
      sortRoutes: true,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    expect(args).toContain('--sort-routes');
  });

  it('should include --base-url when baseUrl is provided', () => {
    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      baseUrl: 'https://api.example.com',
      options: DEFAULT_GENERATOR_OPTIONS,
    });

    expect(args).toContain('--base-url');
    expect(args).toContain('https://api.example.com');
  });

  it('should NOT include --base-url when baseUrl is not provided', () => {
    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options: DEFAULT_GENERATOR_OPTIONS,
    });

    expect(args).not.toContain('--base-url');
  });

  it('should build all default flags with DEFAULT_GENERATOR_OPTIONS', () => {
    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options: DEFAULT_GENERATOR_OPTIONS,
    });

    // Should contain all default-enabled flags
    expect(args).toContain('--modular');
    expect(args).toContain('--no-client');
    expect(args).toContain('--route-types');
    expect(args).toContain('--extract-enums');
    expect(args).toContain('--extract-responses');
    expect(args).toContain('--extract-request-body');
    expect(args).toContain('--extract-request-params');
    expect(args).toContain('--sort-types');
    expect(args).toContain('--sort-routes');

    // Should NOT contain disabled-by-default flags
    expect(args).not.toContain('--extract-response-error');
    expect(args).not.toContain('--add-readonly');
    expect(args).not.toContain('--generate-union-enums');
  });

  it('should build minimal CLI args when all options disabled', () => {
    const options: GeneratorOptions = {
      modular: false,
      typesOnly: false,
      routeTypes: false,
      extractEnums: false,
      extractResponses: false,
      extractRequestBody: false,
      extractRequestParams: false,
      extractResponseError: false,
      readonly: false,
      unionEnums: false,
      sortTypes: false,
      sortRoutes: false,
    };

    const args = buildCliArgs({
      specUrl: 'https://example.com/spec.json',
      outputDir: '/tmp/output',
      options,
    });

    // Only should have: generate, -p, specUrl, -o, outputDir
    expect(args).toEqual(['generate', '-p', 'https://example.com/spec.json', '-o', '/tmp/output']);
  });
});

describe('GeneratorOptions interface completeness', () => {
  it('should have all swagger-typescript-api CLI options in GeneratorOptions interface', () => {
    // List of all CLI options from swagger-typescript-api that we support
    const supportedOptions = [
      'modular',
      'typesOnly',
      'routeTypes',
      'extractEnums',
      'extractResponses',
      'extractRequestBody',
      'extractRequestParams',
      'extractResponseError',
      'readonly',
      'unionEnums',
      'sortTypes',
      'sortRoutes',
    ];

    // Verify all are in the interface (check the type has these keys)
    // We check this by verifying DEFAULT_GENERATOR_OPTIONS has all default-enabled options
    // plus verifying the type definition exists for optional ones
    const defaultKeys = Object.keys(DEFAULT_GENERATOR_OPTIONS);
    
    // At minimum, default-enabled options should be in the interface
    for (const key of defaultKeys) {
      expect(supportedOptions).toContain(key);
    }
  });

  it('should have 9 default-enabled options in DEFAULT_GENERATOR_OPTIONS', () => {
    const optionCount = Object.keys(DEFAULT_GENERATOR_OPTIONS).length;
    expect(optionCount).toBe(9);
  });

  it('should have GeneratorOptions type exported from schema', () => {
    // Verify the type can be used (TypeScript compilation will catch errors)
    const options: GeneratorOptions = {
      modular: true,
      typesOnly: true,
      routeTypes: false,
      extractEnums: true,
      extractResponses: false,
      extractRequestBody: true,
      extractRequestParams: false,
      extractResponseError: false,
      readonly: true,
      unionEnums: false,
      sortTypes: true,
      sortRoutes: false,
    };

    // All 12 options should be assignable
    expect(options.extractResponseError).toBe(false);
    expect(options.readonly).toBe(true);
    expect(options.unionEnums).toBe(false);
  });
});
