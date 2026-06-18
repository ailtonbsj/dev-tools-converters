import { camelToPascalCase } from "../case-util";
import { DatabaseTable, DatabaseTableColunm, Dialect } from "../sql-datastructs/database.model";

export async function buildTestImplJPAFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const pkType = primaries[0].javaType;

  const colStr = columns.filter(col => !col.isPrimary).find(col => col.javaType === 'String') ?? <DatabaseTableColunm>{ column: 'field' };
  const fieldStr = colStr.javaFieldName;
  const fieldStrPascal = camelToPascalCase(fieldStr);

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
