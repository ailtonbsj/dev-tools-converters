import { C } from '@angular/cdk/keycodes';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { TableColunm } from '../ddl-to-module/database-table.model';
import { buildAngularDataTableFromDdl, buildAngularModelFromDdl, buildEntityJPAFromDdl, buildEntityMyBatisFromDdl, buildMyBatisDAOFromDdl, buildSpringDTOFromDdl, columnToFieldJava, columnToPascalFieldJava, Dialect, dllToAst, snakeToCamelCase, snakeToPascalCase } from '../ddl-to-module/module-buillders';

const GeneratedCodeEnum = { jpaEntity: 'jpaEntity', mybatisEntity: 'mybatisEntity', mybatisDAO: 'mybatisDAO',
  springDTO: 'springDTO', angularModel: 'angularModel', angularDataTable: 'angularDataTable' } as const;
type GeneratedCodeType = typeof GeneratedCodeEnum[keyof typeof GeneratedCodeEnum];

@Component({
  selector: 'app-ddl-to-java',
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
  templateUrl: './ddl-to-java.component.html',
  styleUrl: './ddl-to-java.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DdlToJavaComponent {
  protected readonly generatedCodeType = signal<GeneratedCodeType>(GeneratedCodeEnum.jpaEntity);
  protected readonly dialect = signal<Dialect>('postgresql');
  protected readonly ddlInput = signal('');
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

  protected async convertTo(): Promise<void> {
    try {
      if(this.generatedCodeType() === GeneratedCodeEnum.jpaEntity) {
        const entity = await buildEntityJPAFromDdl(this.ddlInput(), this.dialect());
        this.generatedEntity.set(entity);
        this.snackBar.open('Entidade JPA gerada com sucesso.', 'Fechar', { duration: 2500 });
      } else if(this.generatedCodeType() === GeneratedCodeEnum.mybatisEntity) {
        const entity = await buildEntityMyBatisFromDdl(this.ddlInput(), this.dialect());
        this.generatedEntity.set(entity);
        this.snackBar.open('Entidade MyBatis gerada com sucesso.', 'Fechar', { duration: 2500 });
      } else if(this.generatedCodeType() === GeneratedCodeEnum.mybatisDAO) {
        const entity = await buildMyBatisDAOFromDdl(this.ddlInput(), this.dialect());
        this.generatedEntity.set(entity);
        this.snackBar.open('DAO MyBatis gerada com sucesso.', 'Fechar', { duration: 2500 });
      } else if(this.generatedCodeType() === GeneratedCodeEnum.springDTO) {
        const entity = await buildSpringDTOFromDdl(this.ddlInput(), this.dialect());
        this.generatedEntity.set(entity);
        this.snackBar.open('DTO MyBatis gerada com sucesso.', 'Fechar', { duration: 2500 });
      } else if(this.generatedCodeType() === GeneratedCodeEnum.angularModel) {
        const entity = await buildAngularModelFromDdl(this.ddlInput(), this.dialect());
        this.generatedEntity.set(entity);
        this.snackBar.open('Model do Angular gerada com sucesso.', 'Fechar', { duration: 2500 });
      } else if(this.generatedCodeType() === GeneratedCodeEnum.angularDataTable) {
        const entity = await buildAngularDataTableFromDdl(this.ddlInput(), this.dialect());
        this.generatedEntity.set(entity);
        this.snackBar.open('DataTable do Angular gerada com sucesso.', 'Fechar', { duration: 2500 });
      } else {
        this.snackBar.open('A conversão não está disponível.', 'Fechar', { duration: 3000 });
        return;
      }
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}



