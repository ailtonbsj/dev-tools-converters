import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Highlight } from 'ngx-highlightjs';
import { buildEntityMyBatisFromDdl, buildTestImplJPAFromDdl, buildTestResourceFromDdl } from './module-buillders';
import { DatabaseTable } from './sql-datastructs/database.model';
import { buildEntityJPAPrimaryKey } from './boilerplate-files/spring-pk-jpa';
import { buildEntityJPAFromDdl } from './boilerplate-files/spring-entity-jpa';
import { buildRepositoryJPAFromDdl } from './boilerplate-files/spring-repository-jpa';
import { buildSpringDTOFromDdl } from './boilerplate-files/spring-dto';
import { buildServiceFromDdl } from './boilerplate-files/spring-service';
import { buildImplementationJPAFromDdl } from './boilerplate-files/spring-service-impl-jpa';
import { buildMyBatisDAOFromDdl } from './boilerplate-files/spring-dao-mybatis';
import { buildResourceFromDdl } from './boilerplate-files/spring-resource';
import { buildMapperFromDdl } from './boilerplate-files/spring-mapper-struct';
import { buildAngularModelFromDdl } from './boilerplate-files/angular-model';
import { buildAngularServiceFromDdl } from './boilerplate-files/angular-service';
import { buildAngularDataTableFromDdl } from './boilerplate-files/angular-datatable';
import { buildAngularDataTableHTMLFromDdl } from './boilerplate-files/angular-datatable-html';
import { buildAngularDataTableSCSSFromDdl } from './boilerplate-files/angular-datable-scss';
import { buildAngularFormFromDdl } from './boilerplate-files/angular-form';
import { buildAngularFormHTMLFromDdl } from './boilerplate-files/angular-form-html';
import { sqlCreateTableToAST } from './sql-datastructs/datastructs';

export type EditorDialogData = {
  dialect: 'postgresql' | 'oracle';
  pascalCaseModuleName: string;
  humanModuleName: string;
  sqlInput: string;
};

type EditorTab = {
  id: string;
  label: string;
  icon: string;
  language: string;
  code: string;
};

const stylesCss = `
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

/* Estilos adicionais */

.w2-actions {
  width: 116px !important;
}

.w3-actions {
  width: 165px !important;
}

.w4-actions {
  width: 210px !important;
}

input[type="datetime-local"]::-webkit-inner-spin-button,
input[type="datetime-local"]::-webkit-calendar-picker-indicator,
input[type="date"]::-webkit-inner-spin-button,
input[type="date"]::-webkit-calendar-picker-indicator,
input[type="month"]::-webkit-inner-spin-button,
input[type="month"]::-webkit-calendar-picker-indicator {
  display: block;
  -webkit-appearance: button;
}

/* Fix panel header */

.card-header > h1 {
  font-size: 16pt;
  margin: 0;
}

/* Fix paginator */

.pagination-bottom-border {
  border-color: #dee2e6;
  border-style: solid;
  border-width: 0 1px 1px 1px;
}
`;

@Component({
  selector: 'app-editor-dialog',
  standalone: true,
  imports: [Highlight, MatButtonModule, MatDialogModule, MatSnackBarModule],
  templateUrl: './editor-dialog.component.html',
  styleUrl: './editor-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorDialogComponent implements OnInit {
  protected readonly data = inject<EditorDialogData>(MAT_DIALOG_DATA);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly activeTabId = signal('sql');

  jpaPK = signal('');
  jpaEntity = signal('');
  jpaRepository = signal('');
  myBatisEntity = signal('');
  myBatisDAO = signal('');
  springDTO = signal('');
  mapperStruct = signal('');
  serviceSpring = signal('');
  implementationJPA = signal('');
  resourceSpring = signal('');
  testImplJPA = signal('');
  testResource = signal('');

  angularModel = signal('');
  angularService = signal('');
  angularDataTable = signal('');
  angularDataTableHTML = signal('');
  angularDataTableSCSS = signal('');
  angularForm = signal('');
  angularFormHTML = signal('');

  protected readonly tabs = computed<EditorTab[]>(() => [
    {
      id: 'sql',
      label: 'Entrada.sql',
      icon: 'database',
      language: 'sql',
      code: this.data.sqlInput
    },
    {
      id: 'jpaPK',
      label: 'PK Composta JPA.java',
      icon: 'coffee',
      language: 'java',
      code: this.jpaPK()
    },
    {
      id: 'jpaEntity',
      label: 'Entidade JPA.java',
      icon: 'coffee',
      language: 'java',
      code: this.jpaEntity()
    },
    {
      id: 'jpaRepository',
      label: 'Repository JPA.java',
      icon: 'coffee',
      language: 'java',
      code: this.jpaRepository()
    },
    {
      id: 'myBatisEntity',
      label: 'Entidade MyBatis.java',
      icon: 'coffee',
      language: 'java',
      code: this.myBatisEntity()
    },
    {
      id: 'myBatisDAO',
      label: 'DAO MyBatis.java',
      icon: 'coffee',
      language: 'java',
      code: this.myBatisDAO()
    },
    {
      id: 'springDTO',
      label: 'DTO com validadores.java',
      icon: 'coffee',
      language: 'java',
      code: this.springDTO()
    },
    {
      id: 'mapperStruct',
      label: 'Mapper Struct.java',
      icon: 'coffee',
      language: 'java',
      code: this.mapperStruct()
    },
    {
      id: 'serviceSpring',
      label: 'Service Spring.java',
      icon: 'coffee',
      language: 'java',
      code: this.serviceSpring()
    },
    {
      id: 'implementationJPA',
      label: 'ServiceImpl JPA.java',
      icon: 'coffee',
      language: 'java',
      code: this.implementationJPA()
    },
    {
      id: 'resourceSpring',
      label: 'Resource Spring.java',
      icon: 'coffee',
      language: 'java',
      code: this.resourceSpring()
    },
    {
      id: 'testImplJPA',
      label: 'Test ServiceImpl JPA.java',
      icon: 'coffee',
      language: 'java',
      code: this.testImplJPA()
    },
    {
      id: 'testResource',
      label: 'Test Resource.java',
      icon: 'coffee',
      language: 'java',
      code: this.testResource()
    },
    {
      id: 'angularModel',
      label: 'Model Angular.ts',
      icon: 'code',
      language: 'typescript',
      code: this.angularModel()
    },
    {
      id: 'angularService',
      label: 'Service Angular.ts',
      icon: 'code',
      language: 'typescript',
      code: this.angularService()
    },
    {
      id: 'angularDataTableTS',
      label: 'DataTable Angular.ts',
      icon: 'code',
      language: 'typescript',
      code: this.angularDataTable()
    },
    {
      id: 'angularDataTableHTML',
      label: 'DataTable Angular.html',
      icon: 'code_xml',
      language: 'html',
      code: this.angularDataTableHTML()
    },
    {
      id: 'angularDataTableSCSS',
      label: 'DataTable Angular.scss',
      icon: 'style',
      language: 'css',
      code: this.angularDataTableSCSS()
    },
    {
      id: 'angularForm',
      label: 'Form Angular.ts',
      icon: 'code',
      language: 'typescript',
      code: this.angularForm()
    },
    {
      id: 'angularFormHTML',
      label: 'Form Angular.html',
      icon: 'code_xml',
      language: 'html',
      code: this.angularFormHTML()
    },
    {
      id: 'angularStyle',
      label: 'Styles.css',
      icon: 'style',
      language: 'css',
      code: stylesCss
    }
  ]);
  protected readonly activeTab = computed(() => {
    const tabs = this.tabs();
    return tabs.find((tab) => tab.id === this.activeTabId()) ?? tabs[0];
  });

  protected selectTab(tabId: string): void {
    this.activeTabId.set(tabId);
  }

  protected async copyActiveCode(): Promise<void> {
    await navigator.clipboard.writeText(this.activeTab().code);
    this.snackBar.open('Código copíado!', 'Fechar', { duration: 2500 });
  }

  private moduleName(): string {
    return (this.data.pascalCaseModuleName || 'example')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase();
  }

  async ngOnInit() {
    const dialet = this.data.dialect;
    const sqlInput = this.data.sqlInput;
    const moduleName = this.data.pascalCaseModuleName;
    const humanName = this.data.humanModuleName;

    const schema: DatabaseTable = await sqlCreateTableToAST(this.data.sqlInput, dialet);

    this.jpaPK.set(await buildEntityJPAPrimaryKey(moduleName, schema, dialet));
    this.jpaEntity.set(await buildEntityJPAFromDdl(moduleName, schema, dialet));
    this.jpaRepository.set(await buildRepositoryJPAFromDdl(moduleName, schema, dialet));
    this.myBatisEntity.set(await buildEntityMyBatisFromDdl(schema, dialet));
    this.myBatisDAO.set(await buildMyBatisDAOFromDdl(moduleName, schema, dialet));
    this.springDTO.set(await buildSpringDTOFromDdl(moduleName, schema, dialet));
    this.mapperStruct.set(await buildMapperFromDdl(moduleName, schema, sqlInput));
    this.serviceSpring.set(await buildServiceFromDdl(moduleName, schema, dialet));
    this.implementationJPA.set(await buildImplementationJPAFromDdl(moduleName, schema, dialet));
    this.resourceSpring.set(await buildResourceFromDdl(moduleName, humanName, schema, dialet));
    this.testImplJPA.set(await buildTestImplJPAFromDdl(moduleName, humanName, schema, dialet));
    this.testResource.set(await buildTestResourceFromDdl(moduleName, humanName, schema, dialet));
    this.angularModel.set(await buildAngularModelFromDdl(moduleName, schema, dialet));
    this.angularService.set(await buildAngularServiceFromDdl(moduleName, schema, dialet));
    this.angularDataTable.set(await buildAngularDataTableFromDdl(moduleName, humanName, schema, dialet));
    this.angularDataTableHTML.set(await buildAngularDataTableHTMLFromDdl(moduleName, humanName, schema, dialet));
    this.angularDataTableSCSS.set(await buildAngularDataTableSCSSFromDdl());
    this.angularForm.set(await buildAngularFormFromDdl(moduleName, humanName, schema, dialet));
    this.angularFormHTML.set(await buildAngularFormHTMLFromDdl(moduleName, humanName, schema, dialet));

  }

}
