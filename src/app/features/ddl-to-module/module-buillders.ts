import { PgParser } from '@supabase/pg-parser';
import { DatabaseTable, TableColunm } from "./database-table.model";

export type Dialect = 'postgresql' | 'oracle';

export function capitalLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function decapitalLetter(str: string) {
  return str.charAt(0).toLocaleLowerCase() + str.slice(1);
}

export function snakeToCamelCase(snake: string) {
  return snake.split('_').map((t, i) => i === 0 ? decapitalLetter(t) : capitalLetter(t)).join('');
}

export function snakeToPascalCase(snake: string) {
  return snake.split('_').map(t => capitalLetter(t)).join('');
}

export function normalizeColumnOfTable(snakeColunm: string) {
  let res = snakeColunm.toLowerCase().replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^hr_|^vr_|^vl_/g,'') +
    ((/^cd_/i).test(snakeColunm.toLowerCase()) ? 'Id' : '');
		return snakeColunm.toLowerCase().includes('ci_') ? 'id' : res;
}

export function columnToFieldJava(columnOfTable: string) {
  return snakeToCamelCase(normalizeColumnOfTable(columnOfTable));
}

export function columnToPascalFieldJava(columnOfTable: string) {
  return snakeToPascalCase(normalizeColumnOfTable(columnOfTable));
}

export function columnToTypeJava(col: TableColunm, dialect: Dialect) {
  let columnType = 'UNKNOWN_TYPE';
  // let len = '';
  switch (col.type.toLowerCase()) {
    case 'varchar2':
    case 'varchar':
    case 'bpchar':
    case 'text':
      columnType = col.len === 1 ? 'Character' : 'String';
      // len = col.len ? `, length = ${col.len}` : '';
      break;
    case 'numeric':
    case 'real':
    case 'double precision':
    case 'number':
      if(col.scale > 0) {
        columnType = 'BigDecimal';
        // len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
      } else if(col.len > 18) {
        columnType = 'BigDecimal';
        // len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
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
  return columnType;
}

export function columnToTypeTypeScript(col: TableColunm, dialect: Dialect) {
  let columnType = 'UNKNOWN_TYPE';
  switch (col.type.toLowerCase()) {
    case 'varchar2':
    case 'varchar':
    case 'bpchar':
    case 'text':
      columnType = 'string';
      break;
    case 'numeric':
    case 'real':
    case 'double precision':
    case 'number':
      columnType = col.len > 16 ? 'string' : 'number';
      break;
    case 'bigserial':
    case 'bigint':
    case 'serial8':
    case 'int8':
      columnType = 'number';
      break;
    case 'serial':
    case 'smallserial':
    case 'integer':
    case 'smallint':
    case 'serial4':
    case 'int4':
      columnType = 'number';
      break;
    case 'timestamp':
      columnType = 'Date';
      break;
    case 'date':
      columnType = 'Date';
      break;
    case 'bool':
    case 'boolean':
      columnType = 'boolean';
      break;
    default:
      console.log(col.type);
  }
  return columnType;
}

export async function dllToAst(ddl: string): Promise<DatabaseTable> {
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

  const commentColStmts = (tree.stmts as [any])
    .filter(stmtItem => stmtItem.stmt != null && stmtItem.stmt.CommentStmt != null && stmtItem.stmt.CommentStmt.objtype === 'OBJECT_COLUMN').map(s => s.stmt.CommentStmt);
  commentColStmts.map(com => {
    const comment = com.comment;
    const col = com.object.List.items[2].String.sval;
    const schemaCol = schema.columns.find(i => i.column === col);
    console.log(schemaCol);
    if(schemaCol) schemaCol.comment = comment;
    if(schemaCol && comment.includes('Label:')) schemaCol.label = comment.split('Label:')[1].trim();
  })

  return schema;
}

export async function buildEntityJPAFromDdl(ddl: string, dialect: Dialect): Promise<string> {
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
			.replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^hr_|^vr_|^vl_/g,'') + ((/^cd_/i).test(col.column.toLowerCase()) ? 'Id' : '');
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
    const label = col.label != null && col.label !== '' ? `\t/* ${col.label} */\n` : '';

		let colStr = `${label}${refs}${enumVals}${primarykey}${autoincrement}`;
		colStr += `\t@Column(name = "${col.column}", nullable = ${col.isNullable}${len}${unique})\n`;
		colStr += `\tprivate ${columnType} ${columnName};\n\n`;

		entityJPA += colStr;
	}

	entityJPA += '}';

  return entityJPA;
}

export async function buildEntityMyBatisFromDdl(ddl: string, dialect: Dialect): Promise<string> {
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
			.replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^hr_|^vr_|^vl_/g,'') + ((/^cd_/i).test(col.column.toLowerCase()) ? 'Id' : '');
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
    const label = col.label != null && col.label !== '' ? `\t/* ${col.label} */\n` : '';

		let colStr = `${label}${refs}${enumVals}${primarykey}`;
    colStr += `\t// Column(name = "${col.column}", nullable = ${col.isNullable}${len}${unique})\n`;
		colStr += `\tprivate ${columnType} ${columnName};\n\n`;

		entity += colStr;
	}

	entity += '}';

  return entity;
}

export async function buildMyBatisDAOFromDdl(ddl: string, dialect: Dialect): Promise<string> {
  const schema = await dllToAst(ddl);
	const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
  const entityNameCamel = snakeToCamelCase(schema.table.replace('tb_', ''));
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);
  const notPrimaries = columns.filter(col => !col.isPrimary);
  const maxColLength = columns.reduce((prev, curr) => Math.max(curr.column.length, prev), 0);
  const results = columns.map(col => {
    const field = columnToFieldJava(col.column);
    const space = ''.padStart(maxColLength - field.length - 1);
    return `@Result(property = "${field}",${space}column = "${col.column}")`;
  });
  const aliases = columns.map(col => `${col.column.padEnd(maxColLength, ' ')} ${columnToFieldJava(col.column)}`);
  const primariesPredicate = primaries.length === 1 ?
    primaries.map(p => `${p.column} = #{id}`) :
    primaries.map(p => `${p.column} = #{${columnToFieldJava(p.column)}}`);
  const primariesField = primaries.length === 1 ?
    primaries.map(p => `${columnToTypeJava(p, dialect) } id`) :
    primaries.map(p => `${columnToTypeJava(p, dialect) } ${columnToFieldJava(p.column)}`);
  const insertPredicate = columns.map(col => `#{${columnToFieldJava(col.column)}}`);
  const updatePredicate = notPrimaries.map(col => {
    const space = ''.padStart(maxColLength - col.column.length + 1);
    return `${col.column}${space}= #{${columnToFieldJava(col.column)}}`;
  });
  const andClauses = columns.map(col => {
    const strFragment = columnToTypeJava(col, dialect) === 'String' ? ` && !example.get${columnToPascalFieldJava(col.column)}().isBlank()` : '';
    return `and("e.${col.column} = #{example.${columnToFieldJava(col.column)}}", example.get${columnToPascalFieldJava(col.column)}() != null${strFragment})`;
  });
  const fieldToColumnMap = columns.map(col => {
    const field = columnToFieldJava(col.column);
    const space = ''.padStart(maxColLength - field.length - 2);
    return `entry("${field}",${space}"e.${col.column}")`;
  });

  let daoTemplate = `
import org.apache.ibatis.annotations.*;

import java.util.List;
import java.util.Optional;

import static java.util.Map.entry;

@Mapper
public interface ${entityName}DAO {

    @Results(id = "${entityNameCamel}ResultMap", value = {
      ${results.join(',\n      ')}
    })
    @Select("select * from ${schema.schema}.${schema.table} where ${primariesPredicate.join(', ')}")
    Optional<${entityName}> findById(${primariesField.join(', ')});

    @Select("""
    select
      ${aliases.join(',\n      ')}
    from
      ${schema.schema}.${schema.table}
    """)
    List<${entityName}> findAll();

    @Insert("""
      insert into ${schema.schema}.${schema.table} values (
        ${insertPredicate.join(', ')}
      )
    """)
    int insert(${entityName} model);

    @Update("""
      update ${schema.schema}.${schema.table} set
        ${updatePredicate.join(',\n        ')}
      where
        ${primariesPredicate.join(', ')}
    """)
    int update(${entityName} model);

    @Delete("delete from ${schema.schema}.${schema.table} where ${primariesPredicate.join(', ')}")
    int deleteById(${primariesField.join(', ')});

    @ResultMap("${entityNameCamel}ResultMap")
    @SelectProvider(type = SQLProvider.class,  method = "findByExamplePaginatedAndSorted")
    List<${entityName}> findByExamplePaginatedAndSorted(${entityName} example, Pageable pageable);

    @SelectProvider(type = SQLProvider.class,  method = "countByExample")
    Long countByExample(@Param("example") ${entityName} example);

    class SQLProvider {

      public String findByExamplePaginatedAndSorted(${entityName} example, Pageable pageable) {
        return """
          select * from (
            select row_.*, rownum rownum_ from (

              select e.* from ${schema.schema}.${schema.table} e
              %s
              order by
                %s

            ) row_
          )
          where
            rownum_ <= #{pageable.offset} + #{pageable.pageSize} and
            rownum_ > #{pageable.offset}
        """.formatted(buildWhere(example), buildOrderBy(pageable));
      }

      public String countByExample(${entityName} example) {
          return """
              select count(1) from ${schema.schema}.${schema.table} e
              %s
          """.formatted(buildWhere(example));
      }

      private String buildWhere(${entityName} example) {
          var clauses = Stream.of(
              ${andClauses.join(',\n              ')}
          ).filter(Objects::nonNull).collect(Collectors.toList());
          if(!clauses.isEmpty()) {
              clauses.set(0, clauses.getFirst().replaceAll("(?i)^and|^or", ""));
              clauses.addFirst("where");
          }
          return clauses.isEmpty() ? "" : String.join("\\n", clauses);
      }

      private String and(String sql, boolean condition) {
          return condition ? "and " + sql : null;
      }

      private String buildOrderBy(Pageable pageable) {
          if (pageable.getSort().isUnsorted()) return FIELDMAP.get("id") + "asc";
          return pageable.getSort().stream().map(order -> {
              String column = FIELDMAP.get(order.getProperty());
              if (column == null) throw new ResponseStatusException(BAD_REQUEST, "Campo de ordenamento inválido." );
              return column + " " + order.getDirection().name();
          }).collect(Collectors.joining(", "));
      }

      private static final Map<String, String> FIELDMAP = Map.ofEntries(
        ${fieldToColumnMap.join(',\n        ')}
      );

    }
}
  `;

  return daoTemplate;
}

export async function buildSpringDTOFromDdl(ddl: string, dialect: Dialect): Promise<string> {
  const schema = await dllToAst(ddl);
	const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
  const columns = schema.columns;

  const properties = columns.map(col => {
    const type = columnToTypeJava(col, dialect);
    const field = columnToFieldJava(col.column);
    const label = col.label != null && col.label !== '' ? col.label : field;
    const pkValid = col.isPrimary ? `@Null(message = "O campo ${label} precisa está vazio.")\n  ` : '';
    const notBlankOrNull = ['String'].includes(type) ?
      `@NotBlank(message = "O campo ${label} não pode ser nulo ou em branco.")` : `@NotNull(message = "O campo ${label} não pode ser nulo.")`;
    const notNullValid = !col.isNullable ? `${notBlankOrNull}\n  ` : '';
    const sizeValid = col.len > 0 && ['String'].includes(type) && pkValid === '' ?
      `@Size(max = ${col.len}, message = "O campo ${label} aceita no máximo ${col.len} caracteres.")\n  ` : '';
    const scaleMessage = col.scale > 0 ? ` e ${col.scale} decimais.` : '.';
    const digitValid = col.len > 0 && ['Integer', 'Long', 'BigDecimal', 'Double'].includes(type) && pkValid === '' ?
      `@Digits(integer = ${col.len}, fraction = ${col.scale}, message = "O campo ${label} só permite ${col.len} digitos inteiros${scaleMessage}")\n  ` : '';
    const labelComment = col.label != null && col.label !== '' ? `/* ${col.label} */\n  ` : '';

    return `${labelComment}${pkValid}${notNullValid}${sizeValid}${digitValid}private ${type} ${field};`;
  });


  let template = `

import jakarta.validation.constraints.*;
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class ${entityName}DTO implements Serializable {

  ${properties.join('\n\n  ')}

}
  `;

  return template;
}

export async function buildAngularModelFromDdl(ddl: string, dialect: Dialect): Promise<string> {
  const schema = await dllToAst(ddl);
	const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
  const columns = schema.columns;
  const properties = columns.map(col => `${columnToFieldJava(col.column)}: ${columnToTypeTypeScript(col, dialect)}`);

  const modelTemplate = `
export interface ${entityName} {
  ${properties.join('\n  ')}
}
  `;
  return modelTemplate;
}

export async function buildAngularDataTableFromDdl(ddl: string, dialect: Dialect): Promise<string> {
  const schema = await dllToAst(ddl);
  const entityNameSnake = schema.table.replace('tb_', '');
  const entityName = snakeToPascalCase(entityNameSnake);
  const columns = schema.columns;

  const formFields = columns.map(field => {
    const fieldName = columnToFieldJava(field.column);
      return `
          <!-- ${field.label} -->
          <div class="fx-col-1">
            <mat-form-field appearance="outline">
              <mat-label>${field.label}</mat-label>
              <input matInput type="text" formControlName="${fieldName}" />
              @if(form.controls.${fieldName}.invalid){
              <mat-error>Campo obrigatório.</mat-error>
              }
            </mat-form-field>
          </div>`;
  });

  const tableColumns = columns.map(column => {
    const colName = columnToFieldJava(column.column);
    return `
        <!-- ${column.label} Column -->
        <ng-container matColumnDef="${colName}">
          <th mat-header-cell *matHeaderCellDef mat-sort-header class="th-bold-center">
            ${column.label}
            <app-sort-icon column="${colName}" [sorts]="sorts()" />
          </th>
          <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6">
            {{ el.${colName} }}
            @if (el.${colName} === null) {
            <mat-chip>{{ dataNotFound }}</mat-chip>
            }
          </td>
        </ng-container>`;
  });

  const datatableTemplate = `
import { AfterViewInit, Component, inject, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from 'src/app/shared/material.module';
import { Page } from 'src/app/shared/models/page.model';
import { PageEvent } from '@angular/material/paginator';
import { PageControl } from 'src/app/shared/models/page-control.model';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { AlertService } from '@seduc/ngx-components';
import { SpinnerTextService } from 'src/app/shared/services/spinner-text.service';
import { MatSort, Sort } from '@angular/material/sort';
import { ${entityName} } from '../${entityNameSnake}.model';
import { ${entityName}Service } from '../${entityNameSnake}.service';

@Component({
  selector: 'app-${entityNameSnake}-datatable',
  imports: [ReactiveFormsModule, MaterialModule],
  template: \`
<div class="container-fluid py-3">
  <div class="card">
    <div class="card-header bg-primary">
      <h1>Consulta ${entityName}</h1>
    </div>
    <div class="card-body">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">

        <div class="fx-grid">
          ${formFields.join('\n')}

        </div>

        <div class="d-flex">
          <button type="submit" mat-raised-button color="primary" class="me-2" [disabled]="isLoading">
            <i class="fa-solid fa-magnifying-glass"></i> Consultar
          </button>
          <button type="button" mat-raised-button (click)="clearForm()" [disabled]="isLoading">
            <i class="fa-solid fa-eraser"></i> Limpar
          </button>
          <a routerLink="./new" class="ms-auto" [hidden]="true">
            <button type="button" color="primary" mat-raised-button>
              <i class="fa-solid fa-plus"></i>
              Novo
            </button>
          </a>
        </div>

      </form>
    </div>
  </div>
</div>

<div class="container-fluid py-3">
  <div class="card">
    <div class="card-header">
      Resultado
    </div>
    <div class="card-body">
      <div class="datatable-panel">
        <table mat-table [dataSource]="datasource" matSort multiTemplateDataRows
          class="table table-striped table-hover table-bordered table-condensed table-border-brown">
          ${tableColumns.join('\n')}

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="th-bold-center">
              Ações
            </th>
            <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6 w2-actions">
              <button type="button" mat-icon-button color="primary" matTooltip="Visualizar">
                <mat-icon>visibility</mat-icon>
              </button>
            </td>
          </ng-container>

          <!-- Footer Column -->
          <ng-container matColumnDef="footer">
            <td mat-footer-cell *matFooterCellDef [attr.colspan]="displayedColumns.length" class="bg-color-lightbrown">
              <div class="container p-3">
                <div class="row g-3 text-center">
                  <div class="col-12 fs-6">
                    @if(isLoading) {
                    <i class="fa-solid fa-spinner fa-spin-pulse"></i> Carregando ...
                    } @else {
                    {{ isFirstSearch ? 'Faça uma consulta.' : 'Nenhum registro encontrado.' }}
                    }
                  </div>
                </div>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          <tr mat-footer-row *matFooterRowDef="displayFooter" [hidden]="displayFooter.length === 0"></tr>
        </table>
      </div>

      <mat-paginator [length]="entityPage.totalElements" [pageSize]="entityPage.size" [pageIndex]="entityPage.number"
        [showFirstLastButtons]="true" [pageSizeOptions]="[5, 10, 20, 50, 100]" (page)="onPageChange($event)"
        aria-label="Selecione a página" class="pagination-bottom-border">
      </mat-paginator>

    </div>
  </div>
</div>
  \`,
  styles: [\`
/* Flex helpers */

.fx-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
  --gap-diff: 16px;

  & mat-form-field {
    width: 100%;
  }

  >div {
    min-width: 1px;
    flex-grow: 1;
    flex-shrink: 1;
    flex-basis: calc(100% / 12 - var(--gap-diff));
  }

  >.fx-col-1 {
    flex-basis: calc(100% / 12 - var(--gap-diff));
  }

  >.fx-col-2 {
    flex-basis: calc(100% / 6 - var(--gap-diff));
  }

  >.fx-col-3 {
    flex-basis: calc(100% / 4 - var(--gap-diff));
  }

  >.fx-col-4 {
    flex-basis: calc(100% / 3 - var(--gap-diff));
  }

  >.fx-col-5 {
    flex-basis: calc(5 * (100% / 12) - var(--gap-diff));
  }

  >.fx-col-6 {
    flex-basis: calc(100% / 2 - var(--gap-diff));
  }

  >.fx-col-12 {
    flex-basis: 100%;
  }
}

@media (min-width: 992px) and (max-width: 1200px) {

  .fx-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0 16px;
    --gap-diff: 16px;

    >div {
      min-width: 1px;
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: calc(100% / 6 - var(--gap-diff));
    }

    >.fx-col-1 {
      flex-basis: calc(100% / 6 - var(--gap-diff));
    }

    >.fx-col-2 {
      flex-basis: calc(100% / 3 - var(--gap-diff));
    }

    >.fx-col-3 {
      flex-basis: calc(100% / 2 - var(--gap-diff));
    }

    >.fx-col-4 {
      flex-basis: calc(2 * (100% / 3) - var(--gap-diff));
    }

    >.fx-col-5 {
      flex-basis: calc(10 * (100% / 12) - var(--gap-diff));
    }

    >.fx-col-6,
    >.fx-col-12 {
      flex-basis: 100%;
    }
  }

}

@media (min-width: 768px) and (max-width: 992px) {

  .fx-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0 16px;
    --gap-diff: 16px;

    >div {
      min-width: 1px;
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: calc(100% / 6 - var(--gap-diff));
    }

    >.fx-col-1 {
      flex-basis: calc(100% / 6 - var(--gap-diff));
    }

    >.fx-col-2 {
      flex-basis: calc(100% / 3 - var(--gap-diff));
    }

    >.fx-col-3 {
      flex-basis: calc(100% / 2 - var(--gap-diff));
    }

    >.fx-col-4 {
      flex-basis: calc(2 * (100% / 3) - var(--gap-diff));
    }

    >.fx-col-5 {
      flex-basis: calc(10 * (100% / 12) - var(--gap-diff));
    }

    >.fx-col-6,
    >.fx-col-12 {
      flex-basis: 100%;
    }
  }

}

@media (min-width: 576px) and (max-width: 768px) {

  .fx-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0 16px;
    --gap-diff: 16px;

    >div {
      min-width: 1px;
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: calc(100% / 4 - var(--gap-diff));
    }

    >.fx-col-1 {
      flex-basis: calc(100% / 4 - var(--gap-diff));
    }

    >.fx-col-2 {
      flex-basis: calc(100% / 2 - var(--gap-diff));
    }

    >.fx-col-3 {
      flex-basis: calc(3 * (100% / 4) - var(--gap-diff));
    }

    >.fx-col-4,
    >.fx-col-5,
    >.fx-col-6,
    >.fx-col-12 {
      flex-basis: 100%;
    }

  }

}

@media (max-width: 576px) {

  .fx-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0 16px;
    --gap-diff: 16px;

    >div {
      min-width: 1px;
      flex-grow: 1;
      flex-shrink: 1;
      flex-basis: 100%;
    }

    >.fx-col-1,
    >.fx-col-2,
    >.fx-col-3,
    >.fx-col-4,
    >.fx-col-5,
    >.fx-col-6,
    >.fx-col-12 {
      flex-basis: 100%;
    }

  }

}

/* Fix panel header */

.card-header > h1 {
  font-size: 16pt;
  margin: 0;
}

/* Fix Mat Table */

.table-border-brown {
  border-color: #dee2e6;
  margin: 0 !important;
}

.th-bold-center {
  font-size: 16px;
  font-weight: bold;
  vertical-align: middle;
  text-align: center;
}

.bg-color-lightbrown {
  background-color: #f2f2f2;
}

::ng-deep .mat-sort-header-container {
  display: flex;
  justify-content: center;
}

::ng-deep .mat-sort-header .mat-sort-header-arrow {
  display: none !important;
}

.datatable-panel {
  overflow-x: auto;
  scrollbar-width: 6px;
}

.datatable-panel::-webkit-scrollbar-thumb {
  background-color: #388e3c;
  border-radius: 6px;
}

.datatable-panel::-webkit-scrollbar {
  height: 6px;
}

/* Fix Paginator */

.pagination-bottom-border {
  border-color: #dee2e6;
  border-style: solid;
  border-width: 0 1px 1px 1px;
}

/* Estilos adicionais */

.w2-actions {
  width: 116px !important;
}

  \`]
})
export class ${entityName}DataTableComponent implements AfterViewInit {

  private fb = inject(FormBuilder);
  private alert = inject(AlertService);
  private spinnerText = inject(SpinnerTextService);
  private service = inject(${entityName}Service);

  form = this.fb.group({
    ${columns.map(c => columnToFieldJava(c.column) + ': [\'\'],').join('\n    ')}
  });

  isFirstSearch = true;
  enableSearch = false;
  isLoading = false;

  datasource = new MatTableDataSource(<${entityName}[]>[]);
  displayedColumns: string[] = [${columns.map(c => '\'' + columnToFieldJava(c.column) + '\'').join(', ')}, 'actions'];
  displayFooter = ['footer'];

  readonly dataNotFound = 'Não foi informado!';

  entity = <${entityName}>{};
  entityPage = <Page<${entityName}>>{ size: 10 };
  pageCtl: PageControl = <PageControl>{
    pageNumber: 0,
    pageSize: 10,
    directions: 'desc',
    sortProps: 'id',
  };

  @ViewChild(MatSort) sortViewChild: MatSort = <MatSort>{};
  sorts = signal<{ active: string, direction: string }[]>([]);

  ngAfterViewInit(): void {
    this.sortViewChild.sortChange.subscribe({
      next: (sort: Sort) => {
        const item = this.sorts().find(o => o.active === sort.active);
        if (item) {
          if (sort.direction !== '') item.direction = sort.direction;
          else this.sorts.set(this.sorts().filter(o => o.active != item.active));
        } else {
          if (sort.direction !== '') {
            const sortsArr = this.sorts();
            sortsArr.push(sort);
            this.sorts.set(sortsArr);
          }
        }
        const sortProps = this.sorts().map(o => o.active).join(',');
        const directions = this.sorts().map(o => o.direction).join(',');
        if (sortProps !== this.pageCtl.sortProps || directions !== this.pageCtl.directions) {
          this.pageCtl.sortProps = sortProps;
          this.pageCtl.directions = directions;
          this.search();
        }
      }
    });
  }

  onSubmit() {
    this.trimFields();
    if (this.form.valid) {
      this.pageCtl.pageNumber = 0;
      this.entity = <${entityName}>{
        ...this.form.value as any,
      };
      this.isFirstSearch = false;
      this.enableSearch = true;
      this.search();
    }
  }

  trimFields() {
    Object.keys(this.form.value)
      .map(f => this.form.get(f))
      .filter(f => typeof f?.value === 'string')
      .map(f => f?.setValue(f?.value.trim()));
  }

  async search() {
    if (!this.enableSearch) return;
    this.enableSearch = false;
    this.isLoading = true;
    this.spinnerText.show('Carregando dados da tabela ...');
    try {
      const page = await firstValueFrom(this.service.filter(this.entity, this.pageCtl));
      this.displayFooter = page.content?.length !== 0 ? [] : ['footer'];
      this.entityPage = page;
      this.datasource = new MatTableDataSource(this.entityPage.content);
    } catch (e: unknown) {
      if (e instanceof HttpErrorResponse) {
        if (e.status === HttpStatusCode.NotFound) {
          this.alertWarn(e.error.message);
        } else if (e.status === HttpStatusCode.BadRequest) {
          this.alertWarn(e.error.message);
        } else console.log(e);
      } else console.log(e);
    }
    this.spinnerText.hide();
    this.isLoading = false;
    this.enableSearch = true;
  }

  onPageChange(event: PageEvent) {
    this.pageCtl.pageNumber = event.pageIndex;
    this.pageCtl.pageSize = event.pageSize;
    this.search();
  }

  clearForm() {
    this.form.reset({
      ${columns.map(c => columnToFieldJava(c.column) + ': \'\',').join('\n      ')}
    });
    this.enableSearch = false;
    this.isFirstSearch = true;
  }

  alertWarn(e: any) {
    this.alert.show({
      title: 'Alerta',
      message: e,
      iconClass: 'fa-solid fa-circle-exclamation',
      type: 'warning',
      timeout: 15000,
    });
  }

}
  `;
  return datatableTemplate;
}
