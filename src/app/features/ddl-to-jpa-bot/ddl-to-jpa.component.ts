import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

type Dialect = 'postgresql' | 'oracle';

type ColumnDefinition = {
  columnName: string;
  javaName: string;
  sqlType: string;
  javaType: string;
  nullable: boolean;
  primaryKey: boolean;
};

@Component({
  selector: 'app-ddl-to-jpa',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  templateUrl: './ddl-to-jpa.component.html',
  styleUrl: './ddl-to-jpa.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DdlToJpaComponent {
  protected readonly dialect = signal<Dialect>('postgresql');
  protected readonly ddlInput = signal(`CREATE TABLE customer_account (
  id BIGINT PRIMARY KEY,
  customer_name VARCHAR(150) NOT NULL,
  email VARCHAR(180),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL
);`);
  protected readonly generatedEntity = signal('');
  protected readonly highlightedSql = computed(() => this.highlightSql(this.ddlInput()));
  protected readonly highlightedJava = computed(() => this.highlightJava(this.generatedEntity()));

  constructor(private readonly snackBar: MatSnackBar) {}

  protected async pasteFromClipboard(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        this.ddlInput.set(text);
      }
    } catch {
      this.snackBar.open('Não foi possível ler a área de transferência.', 'Fechar', { duration: 3000 });
    }
  }

  protected convertToJpa(): void {
    try {
      const entity = buildEntityFromDdl(this.ddlInput(), this.dialect());
      this.generatedEntity.set(entity);
      this.snackBar.open('Entidade JPA gerada com sucesso.', 'Fechar', { duration: 2500 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao converter o DDL.';
      this.snackBar.open(message, 'Fechar', { duration: 4000 });
    }
  }

  protected async copyGeneratedCode(): Promise<void> {
    if (!this.generatedEntity()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.generatedEntity());
      this.snackBar.open('Código Java copiado para a área de transferência.', 'Fechar', { duration: 2500 });
    } catch {
      this.snackBar.open('Não foi possível copiar o código gerado.', 'Fechar', { duration: 3000 });
    }
  }

  protected onSqlInput(value: string): void {
    this.ddlInput.set(value);
  }

  private highlightSql(sql: string): string {
    return escapeHtml(sql)
      .replace(/\b(CREATE|TABLE|PRIMARY|KEY|NOT|NULL|DEFAULT|CONSTRAINT|FOREIGN|REFERENCES|UNIQUE)\b/gi, '<span class="token keyword">$1</span>')
      .replace(/\b(VARCHAR2?|CHAR|TEXT|NUMBER|NUMERIC|INTEGER|INT|BIGINT|SMALLINT|DECIMAL|TIMESTAMP|DATE|BOOLEAN|CLOB|BLOB)\b/gi, '<span class="token type">$1</span>')
      .replace(/('[^']*')/g, '<span class="token string">$1</span>')
      .replace(/\b([a-z_][a-z0-9_]*)\b(?=\s+(?:VARCHAR2?|CHAR|TEXT|NUMBER|NUMERIC|INTEGER|INT|BIGINT|SMALLINT|DECIMAL|TIMESTAMP|DATE|BOOLEAN|CLOB|BLOB))/gi, '<span class="token identifier">$1</span>');
  }

  private highlightJava(code: string): string {
    const javaTokenPattern =
      /("[^"]*")|(@[A-Za-z]+)|\b(import|public|class|private)\b|\b(String|Long|Integer|Short|Boolean|BigDecimal|LocalDate|LocalDateTime|byte\[\])\b/g;

    return escapeHtml(code).replace(javaTokenPattern, (match, stringLiteral, decorator, keyword, type) => {
      if (stringLiteral) {
        return `<span class="token string">${match}</span>`;
      }

      if (decorator) {
        return `<span class="token decorator">${match}</span>`;
      }

      if (keyword) {
        return `<span class="token keyword">${match}</span>`;
      }

      if (type) {
        return `<span class="token type">${match}</span>`;
      }

      return match;
    });
  }
}

function buildEntityFromDdl(ddl: string, dialect: Dialect): string {
  const normalized = ddl.replace(/\r/g, '').trim();
  const tableMatch = normalized.match(/create\s+table\s+("?[\w$.]+"?)\s*\(([\s\S]+)\)\s*;?/i);

  if (!tableMatch) {
    throw new Error('Informe um comando CREATE TABLE válido.');
  }

  const tableName = stripQuotes(tableMatch[1].split('.').pop() ?? tableMatch[1]);
  const body = tableMatch[2];
  const parts = splitSqlDefinitions(body);
  const primaryKeyColumns = new Set<string>();
  const columns: ColumnDefinition[] = [];

  for (const part of parts) {
    const cleaned = part.trim();
    if (!cleaned) {
      continue;
    }

    const pkConstraintMatch = cleaned.match(/primary\s+key\s*\((.+)\)/i);
    if (pkConstraintMatch) {
      extractColumnNames(pkConstraintMatch[1]).forEach((column) => primaryKeyColumns.add(column));
      continue;
    }

    if (/^(constraint|foreign|unique|check)\b/i.test(cleaned)) {
      continue;
    }

    const columnMatch = cleaned.match(/^"?([\w$]+)"?\s+([a-z]+(?:\s*\([^)]*\))?)/i);
    if (!columnMatch) {
      continue;
    }

    const columnName = stripQuotes(columnMatch[1]);
    const sqlType = columnMatch[2].trim().toUpperCase();
    const inlinePrimaryKey = /\bprimary\s+key\b/i.test(cleaned);
    if (inlinePrimaryKey) {
      primaryKeyColumns.add(columnName);
    }

    columns.push({
      columnName,
      javaName: toCamelCase(columnName),
      sqlType,
      javaType: mapSqlTypeToJava(sqlType, dialect),
      nullable: !/\bnot\s+null\b/i.test(cleaned) && !inlinePrimaryKey,
      primaryKey: inlinePrimaryKey
    });
  }

  if (!columns.length) {
    throw new Error('Nenhuma coluna válida foi encontrada no DDL informado.');
  }

  for (const column of columns) {
    if (primaryKeyColumns.has(column.columnName)) {
      column.primaryKey = true;
      column.nullable = false;
    }
  }

  const className = toPascalCase(tableName);
  const imports = new Set<string>(['import jakarta.persistence.*;']);

  if (columns.some((column) => column.javaType === 'LocalDateTime')) {
    imports.add('import java.time.LocalDateTime;');
  }

  if (columns.some((column) => column.javaType === 'LocalDate')) {
    imports.add('import java.time.LocalDate;');
  }

  if (columns.some((column) => column.javaType === 'BigDecimal')) {
    imports.add('import java.math.BigDecimal;');
  }

  const fields = columns
    .map((column) => {
      const annotations: string[] = [];

      if (column.primaryKey) {
        annotations.push('  @Id');
      }

      annotations.push(
        `  @Column(name = "${column.columnName}"${column.nullable ? '' : ', nullable = false'})`
      );

      return `${annotations.join('\n')}\n  private ${column.javaType} ${column.javaName};`;
    })
    .join('\n\n');

  return `${Array.from(imports).sort().join('\n')}

@Entity
@Table(name = "${tableName}")
public class ${className} {

${fields}
}`;
}

function splitSqlDefinitions(body: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const character of body) {
    if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
    }

    if (character === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}

function extractColumnNames(value: string): string[] {
  return value
    .split(',')
    .map((item) => stripQuotes(item.trim()))
    .filter(Boolean);
}

function stripQuotes(value: string): string {
  return value.replace(/^"|"$/g, '');
}

function toPascalCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function mapSqlTypeToJava(sqlType: string, dialect: Dialect): string {
  const baseType = sqlType.replace(/\(.*/, '').trim().toUpperCase();
  const mappings: Record<Dialect, Record<string, string>> = {
    postgresql: {
      BIGINT: 'Long',
      BIGSERIAL: 'Long',
      BOOLEAN: 'Boolean',
      DATE: 'LocalDate',
      DECIMAL: 'BigDecimal',
      INTEGER: 'Integer',
      INT: 'Integer',
      NUMERIC: 'BigDecimal',
      SMALLINT: 'Short',
      TEXT: 'String',
      TIMESTAMP: 'LocalDateTime',
      VARCHAR: 'String'
    },
    oracle: {
      BLOB: 'byte[]',
      CHAR: 'String',
      CLOB: 'String',
      DATE: 'LocalDate',
      NUMBER: 'BigDecimal',
      NUMERIC: 'BigDecimal',
      TIMESTAMP: 'LocalDateTime',
      VARCHAR2: 'String'
    }
  };

  const mapped = mappings[dialect][baseType];
  if (mapped) {
    return mapped;
  }

  if (baseType.startsWith('VARCHAR')) {
    return 'String';
  }

  if (baseType === 'NUMBER') {
    return 'BigDecimal';
  }

  return 'String';
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
