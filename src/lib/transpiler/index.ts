import { IRProgram } from './ir';
import { PythonParser } from './parsers/python-parser';
import { CParser } from './parsers/c-parser';
import { CppParser } from './parsers/cpp-parser';
import { JavaParser } from './parsers/java-parser';
import { PythonGenerator } from './generators/python-generator';
import { CGenerator } from './generators/c-generator';
import { CppGenerator } from './generators/cpp-generator';
import { JavaGenerator } from './generators/java-generator';

export type Language = 'python' | 'c' | 'cpp' | 'java';

export interface TranspileResult {
  success: boolean;
  python?: string;
  c?: string;
  cpp?: string;
  java?: string;
  errors: string[];
}

export class Transpiler {
  private pythonParser = new PythonParser();
  private cParser = new CParser();
  private cppParser = new CppParser();
  private javaParser = new JavaParser();
  
  private pythonGenerator = new PythonGenerator();
  private cGenerator = new CGenerator();
  private cppGenerator = new CppGenerator();
  private javaGenerator = new JavaGenerator();

  transpile(sourceCode: string, sourceLanguage: Language): TranspileResult {
    const errors: string[] = [];
    
    try {
      // Parse source code to IR
      let ir: IRProgram;
      
      switch (sourceLanguage) {
        case 'python':
          ir = this.pythonParser.parse(sourceCode);
          break;
        case 'c':
          ir = this.cParser.parse(sourceCode);
          break;
        case 'cpp':
          ir = this.cppParser.parse(sourceCode);
          break;
        case 'java':
          ir = this.javaParser.parse(sourceCode);
          break;
        default:
          throw new Error(`Unsupported source language: ${sourceLanguage}`);
      }
      
      // Generate code for all target languages
      const result: TranspileResult = {
        success: true,
        errors: [],
      };
      
      try {
        result.python = this.pythonGenerator.generate(ir);
      } catch (e) {
        errors.push(`Python generation error: ${e}`);
      }
      
      try {
        result.c = this.cGenerator.generate(ir);
      } catch (e) {
        errors.push(`C generation error: ${e}`);
      }
      
      try {
        result.cpp = this.cppGenerator.generate(ir);
      } catch (e) {
        errors.push(`C++ generation error: ${e}`);
      }
      
      try {
        result.java = this.javaGenerator.generate(ir);
      } catch (e) {
        errors.push(`Java generation error: ${e}`);
      }
      
      result.errors = errors;
      result.success = errors.length === 0;
      
      return result;
      
    } catch (error) {
      return {
        success: false,
        errors: [`Parse error: ${error}`],
      };
    }
  }
}

// Singleton instance for easy use
export const transpiler = new Transpiler();
