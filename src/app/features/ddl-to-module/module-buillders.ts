
import { DatabaseTable, DatabaseTableColunm, Dialect } from "./sql-datastructs/database.model";
import { plural } from '@umatch/pluralize-ptbr';
import { autoComplete, inputText, maskedAsNumber, staticSelect } from './ui-form-components';
import { columnToFieldJava, columnToTypeJava, normalizeColumnOfTable } from "./sql-datastructs/datastructs";
import { capitalLetter, snakeToCamelCase } from "./case-util";

export function snakeToPascalCase(snake: string) {
  return snake.split('_').map(t => capitalLetter(t)).join('');
}

export function pascalToKebabCase(pascal: string) {
  return pascal.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll(' ', '-').toLowerCase();
}

export function pascalToSnakeCase(pascal: string) {
  return pascal.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll(' ', '_').toLowerCase();
}

export function columnToPascalFieldJava(columnOfTable: string) {
  return snakeToPascalCase(normalizeColumnOfTable(columnOfTable));
}

export function columnToTypeTypeScript(col: DatabaseTableColunm, dialect: Dialect) {
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

export async function buildEntityMyBatisFromDdl(schema: DatabaseTable, dialect: Dialect): Promise<string> {

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
			.replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^tp_|^hr_|^vr_|^vl_/g,'') + ((/^cd_/i).test(col.column.toLowerCase()) ? 'Id' : '');
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

export async function buildTestImplJPAFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const pkId = primaries[0].javaFieldName;
  const pkType = columnToTypeJava(primaries[0], dialect);

  const colStr = columns.filter(col => !col.isPrimary).find(col => columnToTypeJava(col, dialect) === 'String') ?? <DatabaseTableColunm>{ column: 'field' };
  const fieldStr = columnToFieldJava(colStr.column);
  const fieldStrPascal = capitalLetter(fieldStr);

  return `
import org.instancio.Instancio;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.instancio.Select.field;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class ${moduleName}ServiceImplTest {

    @InjectMocks
    ${moduleName}Service service;

    @Mock
    ${moduleName}Repository repository;

    @Mock
    ${moduleName}Mapper mapper;

    @Test
    void showDeveExibirNenhumaEntidade() {
        when(repository.findById(any())).thenReturn(Optional.empty());

        var response = service.show(any());

        verify(repository, times(1)).findById(any());
        verify(mapper, times(0)).toDto(any(${moduleName}.class));
        assertTrue(response.isEmpty());
    }

    @Test
    void showDeveExibirUmaEntidade() {
        var entity = Instancio.create(${moduleName}.class);
        var dto = Instancio.create(${moduleName}DTO.class);

        when(repository.findById(any())).thenReturn(Optional.of(entity));
        when(mapper.toDto(any(${moduleName}.class))).thenReturn(dto);

        var response = service.show(any());

        verify(repository, times(1)).findById(any());
        verify(mapper, times(1)).toDto(any(${moduleName}.class));
        assertNotNull(response.orElse(null));
        assertThat(response).isPresent().get().usingRecursiveComparison().isEqualTo(dto);
    }

    @Test
    void indexDeveListarNenhumaEntidade() {
        when(repository.findAll()).thenReturn(Collections.emptyList());
        when(mapper.toDto(anyList())).thenReturn(Collections.emptyList());

        var result = service.index();

        verify(repository, times(1)).findAll();
        verify(mapper, times(1)).toDto(anyList());
        assertEquals(0, result.size());
    }

    @Test
    void indexDeveListarEntidades() {
        int listSize = 3;
        var list = Instancio.ofList(${moduleName}.class).size(listSize).create();
        var dtoList = Instancio.ofList(${moduleName}DTO.class).size(listSize).create();

        when(repository.findAll()).thenReturn(list);
        when(mapper.toDto(anyList())).thenReturn(dtoList);

        var result = service.index();

        verify(repository, times(1)).findAll();
        verify(mapper, times(1)).toDto(anyList());
        assertEquals(listSize, result.size());
        assertThat(result.get(1)).usingRecursiveComparison().isEqualTo(dtoList.get(1));
    }

    @Test
    void createDeveCriarUmaEntidade() {
        var dto = Instancio.create(${moduleName}DTO.class);
        var entity = Instancio.create(${moduleName}.class);

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(entity);

        service.create(dto);

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).save(any());
    }

    @Test
    void createDeveLancarExcecao() {
        var dto = Instancio.create(${moduleName}DTO.class);

        var entity = Instancio.create(${moduleName}.class);

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(entity);
        when(repository.save(any())).thenThrow(
                new DataIntegrityViolationException("", new SQLException("")));

        var ex = assertThrows(ResponseStatusException.class, () -> service.create(dto));

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).save(any());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void updateDeveAtualizarUmaEntidade() {
        var dto = Instancio.create(${moduleName}DTO.class);
        var entity = Instancio.create(${moduleName}.class);

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(entity);

        service.update(any(), dto);

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).save(any());
    }

    @Test
    void updateDeveLancarExcecao() {
        var id = Instancio.create(${pkType}.class);
        var dto = Instancio.create(${moduleName}DTO.class);
        var entity = Instancio.create(${moduleName}.class);

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(entity);
        when(repository.save(any())).thenThrow(
                new DataIntegrityViolationException("", new SQLException("")));

        var ex = assertThrows(ResponseStatusException.class, () -> service.update(id, dto));

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).save(any());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void destroyDeveRemoverUmaEntidade() {
        var entity = Instancio.create(${moduleName}.class);

        when(repository.findById(any())).thenReturn(Optional.of(entity));

        var result = service.destroy(any());

        verify(repository, times(1)).findById(any());
        verify(repository, times(1)).deleteById(any());
        assertTrue(result);
    }

    @Test
    void destroyDeveRetornarFalso() {
        when(repository.findById(any())).thenReturn(Optional.empty());

        var result = service.destroy(any());

        verify(repository, times(1)).findById(any());
        verify(repository, times(0)).deleteById(any());
        assertFalse(result);
    }

    @Test
    void destroyDeveLancarExcecao() {
        var id = Instancio.create(${pkType}.class);
        var entity = Instancio.create(${moduleName}.class);

        when(repository.findById(any())).thenReturn(Optional.of(entity));
        doThrow(new DataIntegrityViolationException("", new SQLException("")))
            .when(repository).deleteById(any());

        var ex = assertThrows(ResponseStatusException.class, () -> service.destroy(id));

        verify(repository, times(1)).findById(any());
        verify(repository, times(1)).deleteById(any());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void filterDevePaginarEntidades() {
        int pageNumber = 0;
        int pageSize = 2;
        int total = 10;
        var dto = Instancio.createBlank(${moduleName}DTO.class);
        var pageable = PageRequest.of(pageNumber, pageSize, mock(Sort.class));
        var domain = Instancio.createBlank(${moduleName}.class);
        var list = Instancio.ofList(${moduleName}.class).size(pageSize).create();
        var page = new PageImpl<>(list, pageable, total);
        var pageItem = Instancio.create(${moduleName}DTO.class);

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(domain);
        when(repository.findAll(any(), any(Pageable.class))).thenReturn(page);
        when(mapper.toDto(any(${moduleName}.class))).thenReturn(pageItem);

        var result = service.filter(dto, pageable);

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).findAll(any(), any(Pageable.class));
        verify(mapper, times(pageSize)).toDto(any(${moduleName}.class));
        assertEquals(pageSize, result.getContent().size());
        assertEquals(total, result.getTotalElements());
        assertNotNull(result.getContent().getFirst());
    }

    @Test
    void filterDeveConsultarPorExemplo() {
        int pageNumber = 0;
        int pageSize = 2;
        int total = 10;
        final String QUERY = "Example";
        var dto = Instancio.createBlank(${moduleName}DTO.class);
        dto.set${fieldStrPascal}(QUERY);
        var pageable = PageRequest.of(pageNumber, pageSize, mock(Sort.class));
        var domain = Instancio.createBlank(${moduleName}.class);
        domain.set${fieldStrPascal}(QUERY);
        var list = Instancio.ofList(${moduleName}.class).size(pageSize).create();
        var page = new PageImpl<>(list, pageable, total);
        var pageItem = Instancio.of(${moduleName}DTO.class).set(field(${moduleName}DTO::get${fieldStrPascal}), QUERY).create();
        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(domain);
        when(repository.findAll(any(), any(Pageable.class))).thenReturn(page);
        when(mapper.toDto(any(${moduleName}.class))).thenReturn(pageItem);

        var result = service.filter(dto, pageable);

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).findAll(any(), any(Pageable.class));
        verify(mapper, times(pageSize)).toDto(any(${moduleName}.class));
        assertEquals(pageSize, result.getContent().size());
        assertEquals(total, result.getTotalElements());
        assertNotNull(result.getContent().getFirst());
        assertThat(result.getContent()).extracting(${moduleName}DTO::get${fieldStrPascal}).containsOnly(QUERY);
    }

    @Test
    void filterDeveOrdernarEntidades() {
        int pageNumber = 0;
        int pageSize = 2;
        int total = 10;
        var dto = Instancio.createBlank(${moduleName}DTO.class);
        var pageable = PageRequest.of(pageNumber, pageSize, Sort.by("id").descending());
        var domain = Instancio.createBlank(${moduleName}.class);
        var item1 = Instancio.of(${moduleName}.class).set(field(${moduleName}::getId), 2${pkType === 'Long' ? 'L' : ''}).create();
        var item2 = Instancio.of(${moduleName}.class).set(field(${moduleName}::getId), 1${pkType === 'Long' ? 'L' : ''}).create();
        var page = new PageImpl<>(List.of(item1, item2), pageable, total);
        var pageItem1 = Instancio.of(${moduleName}DTO.class).set(field(${moduleName}DTO::getId), 2).create();
        var pageItem2 = Instancio.of(${moduleName}DTO.class).set(field(${moduleName}DTO::getId), 1).create();

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(domain);
        when(repository.findAll(any(), any(Pageable.class))).thenReturn(page);
        when(mapper.toDto(item1)).thenReturn(pageItem1);
        when(mapper.toDto(item2)).thenReturn(pageItem2);

        var result = service.filter(dto, pageable);

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).findAll(any(), any(Pageable.class));
        verify(mapper, times(pageSize)).toDto(any(${moduleName}.class));
        assertEquals(pageSize, result.getContent().size());
        assertEquals(total, result.getTotalElements());
        assertNotNull(result.getContent().getFirst());
        assertThat(result.getContent()).extracting(${moduleName}DTO::getId).containsExactly(${pkType === 'Long' ? '2L, 1L' : '2, 1'});
    }

}
`;
}

export async function buildTestResourceFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const columns = schema.columns;
  const pluralKebabName = plural(pascalToKebabCase(moduleName));

  const colStr = columns.filter(col => !col.isPrimary).find(col => columnToTypeJava(col, dialect) === 'String') ?? <DatabaseTableColunm>{ column: 'field' };
  const fieldStr = columnToFieldJava(colStr.column);
  const fieldStrPascal = capitalLetter(fieldStr);

  return `
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.instancio.Instancio;
import org.instancio.junit.WithSettings;
import org.instancio.settings.Keys;
import org.instancio.settings.Settings;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.AssertionsForInterfaceTypes.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@WebMvcTest(${moduleName}Resource.class)
@AutoConfigureMockMvc(addFilters = false)
class ${moduleName}ResourceTest {

    @Autowired
    private MockMvcTester mockMvcTester;

    @MockitoBean
    private JwtGrantedAuthoritiesConverter jwtGrantedAuthoritiesConverter;

    @MockitoBean
    private JwtAuthConverterProperties jwtAuthConverterProperties;

    @MockitoBean
    private AppProperties appProperties;

    @MockitoBean
    private HttpSecurity httpSecurity;

    @MockitoBean
    private ${moduleName}Service service;

    @WithSettings
    private final Settings validationEnabled = Settings.create().set(Keys.BEAN_VALIDATION_ENABLED, true);

    private final ObjectMapper objectMapper = JsonMapper.builder()
        .addModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).build();

    @Test
    void showDeveExibirUmaEntidade() {
        var dto = Instancio.of(${moduleName}DTO.class).create();
        var id = dto.getId();

        when(service.show(id)).thenReturn(Optional.of(dto));

        assertThat(mockMvcTester.get().uri("/${pluralKebabName}/{id}", id))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .hasPathSatisfying("$.id", val -> val.assertThat().isEqualTo(id));
        verify(service).show(id);
    }

    @Test
    void showDeveExibirNenhumaEntidade() {
        var id = 0;

        when(service.show(id)).thenReturn(Optional.empty());

        assertThat(mockMvcTester.get().uri("/${pluralKebabName}/{id}", id))
            .hasStatus(HttpStatus.NOT_FOUND);
        verify(service).show(id);
    }

    @Test
    void indexDeveListarEntidades() {
        int size = 2;
        var list = Instancio.ofList(${moduleName}DTO.class).size(size).create();
        var id = list.getFirst().getId();

        when(service.index()).thenReturn(list);

        assertThat(mockMvcTester.get().uri("/${pluralKebabName}"))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .hasPathSatisfying("$", val -> val.assertThat().asArray().hasSize(size))
            .hasPathSatisfying("$[0].id", val -> val.assertThat().isEqualTo(id));
        verify(service).index();
    }

    @Test
    void indexDeveListarNenhumaEntidade() {
        when(service.index()).thenReturn(List.of());

        assertThat(mockMvcTester.get().uri("/${pluralKebabName}"))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .isEqualTo("[]");
        verify(service).index();
    }

    @Test
    void createDeveCriarUmaEntidade() throws JsonProcessingException {
        var dto = Instancio.of(${moduleName}DTO.class)
          .withSettings(validationEnabled).ignore(field(${moduleName}DTO::getId)).create();
        var json = objectMapper.writeValueAsString(dto);

        assertThat(
                mockMvcTester.post().uri("/${pluralKebabName}")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .hasStatus(HttpStatus.CREATED)
            .body()
            .isEmpty();
        verify(service).create(any(${moduleName}DTO.class));
    }

    @Test
    void createDeveLancarExcecao() throws JsonProcessingException {
        var dto = Instancio.of(${moduleName}DTO.class)
          .withSettings(validationEnabled).ignore(field(${moduleName}DTO::getId)).create();
        var json = objectMapper.writeValueAsString(dto);

        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST))
            .when(service).create(any(${moduleName}DTO.class));

        assertThat(
                mockMvcTester.post().uri("/${pluralKebabName}")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .hasStatus(HttpStatus.BAD_REQUEST);
        verify(service).create(any(${moduleName}DTO.class));
    }

    @Test
    void updateDeveAtualizarUmaEntidade() throws JsonProcessingException {
        var id = 1;
        var dto = Instancio.of(${moduleName}DTO.class)
          .withSettings(validationEnabled).ignore(field(${moduleName}DTO::getId)).create();
        var json = objectMapper.writeValueAsString(dto);

        assertThat(
                mockMvcTester.put().uri("/${pluralKebabName}/{id}", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .hasStatusOk()
            .body()
            .isEmpty();
        verify(service).update(eq(id), any(${moduleName}DTO.class));
    }

    @Test
    void updateDeveLancarExcecao() throws JsonProcessingException {
        var id = 1;
        var dto = Instancio.of(${moduleName}DTO.class)
          .withSettings(validationEnabled).ignore(field(${moduleName}DTO::getId)).create();
        var json = objectMapper.writeValueAsString(dto);

        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST))
            .when(service).update(any(), any(${moduleName}DTO.class));

        assertThat(
                mockMvcTester.put().uri("/${pluralKebabName}/{id}", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .hasStatus(HttpStatus.BAD_REQUEST);
        verify(service).update(any(), any(${moduleName}DTO.class));
    }

    @Test
    void destroyDeveRemoverUmaEntidade() {
        var id = 1;

        when(service.destroy(id)).thenReturn(true);

        assertThat(
                mockMvcTester.delete().uri("/${pluralKebabName}/{id}", id))
            .hasStatusOk()
            .body()
            .isEmpty();
        verify(service).destroy(id);
    }

    @Test
    void destroyDeveRetornarFalso() {
        var id = 1;

        when(service.destroy(id)).thenReturn(false);

        assertThat(
                mockMvcTester.delete().uri("/${pluralKebabName}/{id}", id))
            .hasStatus(HttpStatus.NOT_FOUND)
            .body()
            .isEmpty();
        verify(service).destroy(id);
    }

    @Test
    void destroyDeveLancarExcecao() {
        var id = 1;

        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST)).when(service).destroy(id);

        assertThat(
                mockMvcTester.delete().uri("/${pluralKebabName}/{id}", id))
            .hasStatus(HttpStatus.BAD_REQUEST);
        verify(service).destroy(id);
    }

    @Test
    void filterDeveConsultarPorExemplo() {
        String query = "Example";
        int pageNumber = 0;
        int pageSize = 2;
        int total = 10;
        var dto = Instancio.createBlank(${moduleName}DTO.class);
        dto.set${fieldStrPascal}(query);
        var pageable = PageRequest.of(pageNumber, pageSize, mock(Sort.class));
        var list = Instancio.ofList(${moduleName}DTO.class).size(pageSize).set(field(${moduleName}DTO::get${fieldStrPascal}), query).create();
        var page = new PageImpl<>(list, pageable, total);

        when(service.filter(
            argThat(m -> EqualsBuilder.reflectionEquals(m, dto)),
            any()
        )).thenReturn(page);

        assertThat(
                mockMvcTester.get().uri("/${pluralKebabName}/filter")
                .param("${fieldStr}", query))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .hasPathSatisfying("$.content", val ->
                val.assertThat().asArray().extracting("${fieldStr}").containsOnly(query));
        verify(service).filter(any(${moduleName}DTO.class), any());
    }

    @Test
    void filterDevePaginarEntidades() {
        int pageNumber = 2;
        int pageSize = 2;
        int total = 10;
        int totalPages = Math.ceilDiv(total, pageSize);
        int offset = pageNumber * pageSize;
        var pageable = PageRequest.of(pageNumber, pageSize, mock(Sort.class));
        var list = Instancio.ofList(${moduleName}DTO.class).size(pageSize).create();
        var page = new PageImpl<>(list, pageable, total);

        when(service.filter(
            any(),
            argThat(p -> p.getPageNumber() == pageNumber && p.getPageSize() == pageSize))
        ).thenReturn(page);

        assertThat(
                mockMvcTester.get().uri("/${pluralKebabName}/filter")
                .param("pageNumber", String.valueOf(pageNumber))
                .param("pageSize", String.valueOf(pageSize)))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .hasPathSatisfying("$.totalPages", val -> val.assertThat().isEqualTo(totalPages))
            .hasPathSatisfying("$.totalElements", val -> val.assertThat().isEqualTo(total))
            .hasPathSatisfying("$.size", val -> val.assertThat().isEqualTo(pageSize))
            .hasPathSatisfying("$.pageable.offset", val -> val.assertThat().isEqualTo(offset))
            .hasPathSatisfying("$.pageable.pageNumber", val -> val.assertThat().isEqualTo(pageNumber))
            .hasPathSatisfying("$.content", val -> val.assertThat().asArray().hasSize(pageSize))
            .hasPathSatisfying("$.content[0].id", val -> val.assertThat().isEqualTo(list.getFirst().getId()));
    }

    @Test
    void filterDeveOrdernarEntidades() {
        String directions = "desc,desc";
        String sortProps = "id,${fieldStr}";
        String sortString = "id: DESC,${fieldStr}: DESC";
        int pageNumber = 0;
        int pageSize = 2;
        int total = 10;
        var pageable = PageRequest.of(pageNumber, pageSize, mock(Sort.class));
        var item1 = Instancio.of(${moduleName}DTO.class).set(field(${moduleName}DTO::getId), 2).create();
        var item2 = Instancio.of(${moduleName}DTO.class).set(field(${moduleName}DTO::getId), 1).create();
        var page = new PageImpl<>(List.of(item1, item2), pageable, total);

        when(service.filter(
            any(),
            argThat(p -> p.getSort().toString().equals(sortString)))
        ).thenReturn(page);

        assertThat(
                mockMvcTester.get().uri("/${pluralKebabName}/filter")
                .param("directions", directions)
                .param("sortProps", sortProps))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .hasPathSatisfying("$.content",
                val -> val.assertThat().asArray().extracting("id").containsExactly(2, 1));
    }

}

`;
}
