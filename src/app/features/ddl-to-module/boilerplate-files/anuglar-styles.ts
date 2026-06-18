export const stylesCss = `
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

/* Melhorando cores de componentes desabilitados */
:root {
  --mat-form-field-outlined-disabled-outline-color: rgba(0, 0, 0, 0.13); // input borders
  --mat-form-field-outlined-disabled-input-text-color: rgba(0, 0, 0, 0.7); // input text
  --mat-form-field-outlined-disabled-label-text-color: rgba(0, 0, 0, 0.7); // label text
  --mat-slide-toggle-disabled-label-text-color: rgba(0, 0, 0, 0.7); // slide toggle text
  --mat-select-disabled-trigger-text-color: rgba(0, 0, 0, 0.7); // select text

  .mat-mdc-standard-chip.mdc-evolution-chip--disabled { // chips
    --mat-chip-disabled-container-opacity: 0.8;
  }
}

/* Autocomplete loading */
.list-item-loading .mdc-list-item__primary-text {
  opacity: 0.9 !important;
}
`;
