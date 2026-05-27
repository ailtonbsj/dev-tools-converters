import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Highlight } from 'ngx-highlightjs';
import { buildAngularDataTableFromDdl, buildAngularModelFromDdl, buildEntityJPAFromDdl, buildEntityMyBatisFromDdl, buildMyBatisDAOFromDdl, buildSpringDTOFromDdl } from './module-buillders';

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

  jpaEntity = signal('');
  myBatisEntity = signal('');
  myBatisDAO = signal('');
  springDTO = signal('');
  angularModel = signal('');
  angularDataTable = signal('');

  protected readonly tabs = computed<EditorTab[]>(() => [
    {
      id: 'sql',
      label: 'Entrada.sql',
      icon: 'database',
      language: 'sql',
      code: this.data.sqlInput
    },
    {
      id: 'jpaEntity',
      label: 'Entidade JPA.java',
      icon: 'coffee',
      language: 'java',
      code: this.jpaEntity()
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
      id: 'angularModel',
      label: 'Model Angular.ts',
      icon: 'code',
      language: 'typescript',
      code: this.angularModel()
    },
    {
      id: 'angularDataTable',
      label: 'DataTable Angular.ts',
      icon: 'code',
      language: 'typescript',
      code: this.angularDataTable()
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

  /*  */

  async ngOnInit() {
    const dialet = this.data.dialect;
    const sqlInput = this.data.sqlInput;
    this.jpaEntity.set(await buildEntityJPAFromDdl(sqlInput, dialet));
    this.myBatisEntity.set(await buildEntityMyBatisFromDdl(sqlInput, dialet));
    this.myBatisDAO.set(await buildMyBatisDAOFromDdl(sqlInput, dialet));
    this.springDTO.set(await buildSpringDTOFromDdl(sqlInput, dialet));
    this.angularModel.set(await buildAngularModelFromDdl(sqlInput, dialet));
    this.angularDataTable.set(await buildAngularDataTableFromDdl(sqlInput, dialet));
  }

}
