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

import { PgParser } from '@supabase/pg-parser';
import { DatabaseTable, TableColunm } from './database-table.model';

type Dialect = 'postgresql' | 'oracle';
const GeneratedCodeEnum = { jpaEntity: 'jpaEntity', mybatisEntity: 'mybatisEntity', mybatisDAO: 'mybatisDAO' } as const;
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
  protected readonly ddlInput = signal(`CREATE TABLE public.customer_account (
  my_primary_key BIGINT PRIMARY KEY,
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
      } else {
        this.snackBar.open('A conversão está disponível.', 'Fechar', { duration: 3000 });
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

function capitalLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function decapitalLetter(str: string) {
  return str.charAt(0).toLocaleLowerCase() + str.slice(1);
}

function snakeToCamelCase(snake: string) {
  return snake.split('_').map((t, i) => i === 0 ? decapitalLetter(t) : capitalLetter(t)).join('');
}

function snakeToPascalCase(snake: string) {
  return snake.split('_').map(t => capitalLetter(t)).join('');
}

function normalizeColumnOfTable(snakeColunm: string) {
  let res = snakeColunm.toLowerCase().replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^hr_/g,'') +
    ((/^cd_/i).test(snakeColunm.toLowerCase()) ? 'Id' : '');
		return snakeColunm.toLowerCase().includes('ci_') ? 'id' : res;
}

function columnToFieldJava(columnOfTable: string) {
  return snakeToCamelCase(normalizeColumnOfTable(columnOfTable));
}

async function dllToAst(ddl: string): Promise<DatabaseTable> {
  const parser = new PgParser({ version: 17 });
	const { tree } = await parser.parse(ddl);
	if(tree == null || tree.stmts == null || tree.stmts[0].stmt == null) {
    window.alert('Falha ao converter SQL. Verifique se é um DDL Create válido.');
    return {} as DatabaseTable;
  }
	const createStmt = (tree.stmts[0].stmt as any).CreateStmt;
	const tableElts = createStmt.tableElts;

	const schema = {} as DatabaseTable;
	schema.schema = createStmt.relation.schemaname.toLowerCase();
	schema.table = createStmt.relation.relname.toLowerCase();
	schema.columns = [];

	for(const elt of tableElts) {
		if(elt.ColumnDef) {
			const columnDef = elt.ColumnDef;

			let schemaCol = {} as TableColunm;
			schemaCol.isNullable = true;
			schemaCol.isUnique = false;
			schemaCol.isPrimary = false;
			schemaCol.column =  columnDef.colname.toLowerCase();
			schemaCol.type = columnDef.typeName.names.at(-1).String.sval;
			if((/serial/i).test(schemaCol.type)) schemaCol.autoincrement = true;

			if(columnDef.typeName.typmods) {
				schemaCol.len = columnDef.typeName.typmods[0].A_Const.ival.ival;
				schemaCol.scale = columnDef.typeName.typmods[1] ? columnDef.typeName.typmods[1].A_Const.ival.ival : 0;
			}
			if(columnDef.constraints) {
				for(const constraint of columnDef.constraints) {
					if(constraint.Constraint.contype === 'CONSTR_NOTNULL') schemaCol.isNullable = false;
          if(constraint.Constraint.contype === 'CONSTR_PRIMARY') schemaCol.isPrimary = true;
				}
			}
			schema.columns.push(schemaCol);
		} else if (elt.Constraint) {
			if(elt.Constraint.contype === 'CONSTR_UNIQUE') {
				for(const key of elt.Constraint.keys) {
					const schemaCol = schema.columns.find((c: any) => c.column === key.String.sval.toLowerCase());
					if(schemaCol) schemaCol.isUnique = true;
				}
			} else if(elt.Constraint.contype === 'CONSTR_PRIMARY') {
				for(const key of elt.Constraint.keys) {
					const schemaCol = schema.columns.find((c: any) => c.column === key.String.sval.toLowerCase());
					if(schemaCol) {
						schemaCol.isPrimary = true;
						schemaCol.isNullable = false;
						schemaCol.isUnique = true;
					}
				}
			} else if(elt.Constraint.contype === 'CONSTR_FOREIGN') {
				for(const attr of elt.Constraint.fk_attrs) {
					const schemaCol = schema.columns.find((c: any) => c.column === attr.String.sval.toLowerCase());
					const refTable = elt.Constraint.pktable;
					if(schemaCol)
            schemaCol.references = refTable.schemaname + '.' + refTable.relname + '(' + elt.Constraint.pk_attrs.map((a: any) => a.String.sval).join(',') + ')';
				}
			} else if(elt.Constraint.contype === 'CONSTR_CHECK') { // Oracle constraints
				const rawExpr = elt.Constraint.raw_expr;
				if(rawExpr.NullTest && rawExpr.NullTest.nulltesttype === 'IS_NOT_NULL') {
					if(rawExpr.NullTest.arg.ColumnRef) {
						const col = rawExpr.NullTest.arg.ColumnRef.fields[0].String.sval.toLowerCase();
						const schemaCol = schema.columns.find((c: any) => c.column.toLowerCase() === col);
						if(schemaCol) schemaCol.isNullable = false;
					} else window.alert('Simplifique as constraints mais complexas!');
				} else if(rawExpr.A_Expr && rawExpr.A_Expr.kind === 'AEXPR_IN') {
					const col = rawExpr.A_Expr.lexpr.ColumnRef.fields[0].String.sval.toLowerCase();
					const schemaCol = schema.columns.find((c: any) => c.column.toLowerCase() === col);
					const enumObj = rawExpr.A_Expr.rexpr.List.items.map((i: any) => i.A_Const.sval.sval);
					if(schemaCol && enumObj instanceof Array) schemaCol.allowValues = [...enumObj];
				} else if(rawExpr.A_Expr && rawExpr.A_Expr.kind === 'AEXPR_OP') {
					window.alert('Constraints de operações não são analisadas!');
				} else {
					console.log(elt.Constraint)
				}
			} else {
				console.log(elt.Constraint)
			}
		}
	}
  return schema;
}

async function buildEntityJPAFromDdl(ddl: string, dialect: Dialect): Promise<string> {
  const schema = await dllToAst(ddl);

	const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
	let entityJPA = `
import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "${schema.table}", schema = "${schema.schema}")
@Getter
@Setter
@NoArgsConstructor
public class ${entityName} implements Serializable {\n\n`;

	for(const col of schema.columns) {
		const unique = col.isUnique ? `, unique = true` : '';
		let normalizedColunm = col.column.toLowerCase()
			.replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^hr_/g,'') + ((/^cd_/i).test(col.column.toLowerCase()) ? 'Id' : '');
		normalizedColunm = col.column.toLowerCase().includes('ci_') ? 'id' : normalizedColunm;
		const columnName = snakeToCamelCase(normalizedColunm);
		let columnType = 'UNKNOWN_TYPE';
		let len = '';
		switch (col.type.toLowerCase()) {
			case 'varchar2':
			case 'varchar':
			case 'bpchar':
			case 'text':
				columnType = col.len === 1 ? 'Character' : 'String';
				len = col.len ? `, length = ${col.len}` : '';
				break;
			case 'numeric':
			case 'real':
			case 'double precision':
			case 'number':
				if(col.scale > 0) {
					columnType = 'BigDecimal';
					len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
				} else if(col.len > 18) {
					columnType = 'BigDecimal';
					len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
				}
				else if(col.len > 9) columnType = 'Long';
				else columnType = 'Integer';
				break;
			case 'bigserial':
			case 'bigint':
			case 'serial8':
			case 'int8':
				columnType = 'Long';
				break;
			case 'serial':
			case 'smallserial':
			case 'integer':
			case 'smallint':
			case 'serial4':
			case 'int4':
				columnType = 'Integer';
				break;
			case 'timestamp':
				columnType = 'LocalDateTime';
				break;
			case 'date':
				columnType = dialect === 'oracle' ? 'LocalDateTime' : 'LocalDate';
				break;
			case 'bool':
			case 'boolean':
				columnType = 'Boolean';
				break;
			default:
				console.log(col.type);
		}
		const refs = col.references ? `\t// References: ${col.references}\n` : '';
		const enumVals = col.allowValues ? `\t// Enum: ${col.allowValues.join(', ')}\n` : '';
		const primarykey = col.isPrimary ? `\t@Id\n` : '';
		const autoincrement = col.autoincrement ? `\t@GeneratedValue(strategy = GenerationType.IDENTITY)\n` : '';

		let colStr = `${refs}${enumVals}${primarykey}${autoincrement}`;
		colStr += `\t@Column(name = "${col.column}", nullable = ${col.isNullable}${len}${unique})\n`;
		colStr += `\tprivate ${columnType} ${columnName};\n\n`;

		entityJPA += colStr;
	}

	entityJPA += '}';

  return entityJPA;
}

async function buildEntityMyBatisFromDdl(ddl: string, dialect: Dialect): Promise<string> {
  const schema = await dllToAst(ddl);

	const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
	let entity = `
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class ${entityName} implements Serializable {\n\n`;

	for(const col of schema.columns) {
		const unique = col.isUnique ? `, unique = true` : '';
		let normalizedColunm = col.column.toLowerCase()
			.replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^hr_/g,'') + ((/^cd_/i).test(col.column.toLowerCase()) ? 'Id' : '');
		normalizedColunm = col.column.toLowerCase().includes('ci_') ? 'id' : normalizedColunm;
		const columnName = snakeToCamelCase(normalizedColunm);
		let columnType = 'UNKNOWN_TYPE';
		let len = '';
		switch (col.type.toLowerCase()) {
			case 'varchar2':
			case 'varchar':
			case 'bpchar':
			case 'text':
				columnType = col.len === 1 ? 'Character' : 'String';
				len = col.len ? `, length = ${col.len}` : '';
				break;
			case 'numeric':
			case 'real':
			case 'double precision':
			case 'number':
				if(col.scale > 0) {
					columnType = 'BigDecimal';
					len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
				} else if(col.len > 18) {
					columnType = 'BigDecimal';
					len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
				}
				else if(col.len > 9) columnType = 'Long';
				else columnType = 'Integer';
				break;
			case 'bigserial':
			case 'bigint':
			case 'serial8':
			case 'int8':
				columnType = 'Long';
				break;
			case 'serial':
			case 'smallserial':
			case 'integer':
			case 'smallint':
			case 'serial4':
			case 'int4':
				columnType = 'Integer';
				break;
			case 'timestamp':
				columnType = 'LocalDateTime';
				break;
			case 'date':
				columnType = dialect === 'oracle' ? 'LocalDateTime' : 'LocalDate';
				break;
			case 'bool':
			case 'boolean':
				columnType = 'Boolean';
				break;
			default:
				console.log(col.type);
		}
		const refs = col.references ? `\t// References: ${col.references}\n` : '';
		const enumVals = col.allowValues ? `\t// Enum: ${col.allowValues.join(', ')}\n` : '';
		const primarykey = col.isPrimary ? `\t// Primary Key\n` : '';

		let colStr = `${refs}${enumVals}${primarykey}`;
    colStr += `\t// Column(name = "${col.column}", nullable = ${col.isNullable}${len}${unique})\n`;
		colStr += `\tprivate ${columnType} ${columnName};\n\n`;

		entity += colStr;
	}

	entity += '}';

  return entity;
}

async function buildMyBatisDAOFromDdl(ddl: string, dialect: Dialect): Promise<string> {
  const schema = await dllToAst(ddl);

	const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
	let dao = `
import org.apache.ibatis.annotations.*;

@Mapper
public interface ${entityName}DAO {

  @Update("""
    update ${schema.schema}.${schema.table} set\n`;

  let setCols = [];
  let returnType = 'Long';
	for(const col of schema.columns) {
		//const unique = col.isUnique ? `, unique = true` : '';
		const columnName = columnToFieldJava(col.column);
		let columnType = 'UNKNOWN_TYPE';
		let len = '';
		switch (col.type.toLowerCase()) {
			case 'varchar2':
			case 'varchar':
			case 'bpchar':
			case 'text':
				columnType = col.len === 1 ? 'Character' : 'String';
				len = col.len ? `, length = ${col.len}` : '';
				break;
			case 'numeric':
			case 'real':
			case 'double precision':
			case 'number':
				if(col.scale > 0) {
					columnType = 'BigDecimal';
					len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
				} else if(col.len > 18) {
					columnType = 'BigDecimal';
					len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
				}
				else if(col.len > 9) columnType = 'Long';
				else columnType = 'Integer';
				break;
			case 'bigserial':
			case 'bigint':
			case 'serial8':
			case 'int8':
				columnType = 'Long';
				break;
			case 'serial':
			case 'smallserial':
			case 'integer':
			case 'smallint':
			case 'serial4':
			case 'int4':
				columnType = 'Integer';
				break;
			case 'timestamp':
				columnType = 'LocalDateTime';
				break;
			case 'date':
				columnType = dialect === 'oracle' ? 'LocalDateTime' : 'LocalDate';
				break;
			case 'bool':
			case 'boolean':
				columnType = 'Boolean';
				break;
			default:
				console.log(col.type);
		}
		const refs = col.references ? `\t// References: ${col.references}\n` : '';
		const enumVals = col.allowValues ? `\t// Enum: ${col.allowValues.join(', ')}\n` : '';
		const primarykey = col.isPrimary ? `\t@Id\n` : '';
		const autoincrement = col.autoincrement ? `\t@GeneratedValue(strategy = GenerationType.IDENTITY)\n` : '';

		// let colStr = `${refs}${enumVals}${primarykey}${autoincrement}`;
		// colStr += `\t@Column(name = "${col.column}", nullable = ${col.isNullable}${len}${unique})\n`;
		// colStr += `\tprivate ${columnType} ${columnName};\n\n`;
    if(col.isPrimary) returnType = columnType;
    else setCols.push(`      ${col.column} = #\{${columnName}\}`);
	}
  dao += setCols.join(',\n');

  const primaryColumn = schema.columns.find(c => c.isPrimary);
  let wherePredicate = 'id = #{id}';
  if(primaryColumn) wherePredicate = `${primaryColumn.column} = #{${columnToFieldJava(primaryColumn.column)}}`;
	dao += `\n    where ${wherePredicate}\n  """)\n  ${returnType} update(${entityName} model);\n\n}`;

  return dao;
}

