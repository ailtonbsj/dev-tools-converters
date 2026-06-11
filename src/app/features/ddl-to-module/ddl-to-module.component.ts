import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { Highlight } from 'ngx-highlightjs';
import { EditorDialogComponent } from './editor-dialog.component';

type Dialect = 'postgresql' | 'oracle';

const sqlSample = `CREATE TABLE public.customer_account (
  my_primary_key BIGINT PRIMARY KEY,
  customer_name VARCHAR(150) NOT NULL,
  email VARCHAR(180),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL
);
COMMENT ON COLUMN public.customer_account.my_primary_key IS 'Label: My primary key, UI: maskedAsNumber';
COMMENT ON COLUMN public.customer_account.customer_name  IS 'Label: Constomer name, UI: inputText';
COMMENT ON COLUMN public.customer_account.email          IS 'Label: E-mail, UI: inputEmail';
COMMENT ON COLUMN public.customer_account.active         IS 'Label: Active, UI: staticSelect';
COMMENT ON COLUMN public.customer_account.created_at     IS 'Label: Created at, UI: inputDateTime';
`;

@Component({
  selector: 'app-ddl-to-module',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    Highlight
  ],
  templateUrl: './ddl-to-module.component.html',
  styleUrl: './ddl-to-module.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DdlToModuleComponent {
  protected readonly dialect = signal<Dialect>('postgresql');
  protected readonly pascalCaseModuleName = signal('CustomerAccount');
  protected readonly humanModuleName = signal('Customer Account');
  protected readonly sqlInput = signal(sqlSample);
  protected readonly highlightedSqlInput = signal(sqlSample);

  constructor(private readonly dialog: MatDialog) {}

  protected async pasteFromClipboard(): Promise<void> {
    const text = await navigator.clipboard.readText();

    if (text.trim()) {
      this.sqlInput.set(text);
      this.highlightedSqlInput.set(this.toHighlightValue(text));
    }
  }

  protected syncHighlightScroll(textarea: HTMLTextAreaElement, highlightCode: HTMLElement): void {
    highlightCode.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
  }

  protected onSqlInput(value: string, textarea: HTMLTextAreaElement, highlightCode: HTMLElement): void {
    this.sqlInput.set(value);
    this.highlightedSqlInput.set(this.toHighlightValue(value));
    this.syncHighlightScrollAfterRender(textarea, highlightCode);
  }

  protected generateBoilerplate(form: NgForm): void {
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }

    this.dialog.open(EditorDialogComponent, {
      width: 'min(1400px, calc(100vw - 32px))',
      height: 'min(720px, calc(100vh - 32px))',
      maxWidth: '100vw',
      panelClass: 'editor-dialog-panel',
      data: {
        dialect: this.dialect(),
        pascalCaseModuleName: this.pascalCaseModuleName(),
        humanModuleName: this.humanModuleName(),
        sqlInput: this.sqlInput()
      }
    });
  }

  private syncHighlightScrollAfterRender(textarea: HTMLTextAreaElement, highlightCode: HTMLElement): void {
    requestAnimationFrame(() => {
      this.syncHighlightScroll(textarea, highlightCode);
      requestAnimationFrame(() => this.syncHighlightScroll(textarea, highlightCode));
    });
  }

  private toHighlightValue(value: string): string {
    return value || '\n';
  }
}
