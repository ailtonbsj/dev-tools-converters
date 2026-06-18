import { plural } from "@umatch/pluralize-ptbr";
import { camelToPascalCase, pascalToKebabCase } from "../case-util";
import { DatabaseTable, DatabaseTableColunm, Dialect } from "../sql-datastructs/database.model";

export async function buildTestResourceFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const columns = schema.columns;
  const pluralKebabName = plural(pascalToKebabCase(moduleName));

  const colStr = columns.filter(col => !col.isPrimary).find(col => col.javaType === 'String') ?? <DatabaseTableColunm>{ column: 'field' };
  const fieldStr = colStr.javaFieldName;
  const fieldStrPascal = camelToPascalCase(fieldStr);

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
