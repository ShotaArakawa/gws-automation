import type { Align, DocBlock, SampleQuestion, SampleTemplate } from "../core/samples";

export interface CreatedSample {
  folderName: string;
  templateDocUrl: string;
  outputFolderUrl: string;
  formEditUrl: string;
  formPublishedUrl: string;
}

export interface SampleBuilder {
  /**
   * Creates, in a new folder next to this spreadsheet: the form (linked to this
   * spreadsheet), the document template and a 「PDF」 folder for the output.
   */
  build(sample: SampleTemplate): CreatedSample;
}

export function createGasSampleBuilder(
  spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet = SpreadsheetApp.getActiveSpreadsheet(),
): SampleBuilder {
  return {
    build(sample) {
      const parents = DriveApp.getFileById(spreadsheet.getId()).getParents();
      const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
      const folderName = `${sample.label}サンプル`;
      const folder = parent.createFolder(folderName);
      const outputFolder = folder.createFolder("PDF");

      const doc = DocumentApp.create(sample.documentTitle);
      writeDocument(doc.getBody(), sample.document);
      doc.saveAndClose();
      DriveApp.getFileById(doc.getId()).moveTo(folder);

      const form = FormApp.create(sample.formTitle)
        .setDescription(sample.formDescription)
        .setCollectEmail(false);
      for (const question of sample.questions) addQuestion(form, question);
      form.setDestination(FormApp.DestinationType.SPREADSHEET, spreadsheet.getId());
      DriveApp.getFileById(form.getId()).moveTo(folder);

      return {
        folderName,
        templateDocUrl: doc.getUrl(),
        outputFolderUrl: outputFolder.getUrl(),
        formEditUrl: form.getEditUrl(),
        formPublishedUrl: form.getPublishedUrl(),
      };
    },
  };
}

function addQuestion(form: GoogleAppsScript.Forms.Form, question: SampleQuestion): void {
  const item = (() => {
    switch (question.type) {
      case "text":
        return form.addTextItem();
      case "paragraph":
        return form.addParagraphTextItem();
      case "email":
        return form
          .addTextItem()
          .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());
      case "number":
        return form
          .addTextItem()
          .setValidation(
            FormApp.createTextValidation()
              .requireNumber()
              .setHelpText("数字のみで入力してください")
              .build(),
          );
      case "date":
        return form.addDateItem();
      case "choice":
        return form.addMultipleChoiceItem().setChoiceValues([...(question.choices ?? [])]);
    }
  })();
  item.setTitle(question.title).setRequired(question.required);
  if (question.help !== undefined) item.setHelpText(question.help);
}

const ALIGNMENT: Record<Align, () => GoogleAppsScript.Document.HorizontalAlignment> = {
  left: () => DocumentApp.HorizontalAlignment.LEFT,
  center: () => DocumentApp.HorizontalAlignment.CENTER,
  right: () => DocumentApp.HorizontalAlignment.RIGHT,
};

const LABEL_BACKGROUND = "#f1f3f4";

function writeDocument(body: GoogleAppsScript.Document.Body, blocks: readonly DocBlock[]): void {
  body.setMarginTop(56).setMarginBottom(56).setMarginLeft(64).setMarginRight(64);
  for (const block of blocks) {
    switch (block.kind) {
      case "title":
        body
          .appendParagraph(block.text)
          .setAlignment(ALIGNMENT.center())
          .editAsText()
          .setFontSize(24)
          .setBold(true);
        break;
      case "paragraph":
        // One paragraph per line, so that alignment and style apply to every line.
        for (const line of block.text.split("\n")) {
          const paragraph = body
            .appendParagraph(line)
            .setAlignment(ALIGNMENT[block.align ?? "left"]());
          // Styling an empty text element throws, so blank lines keep the default style.
          if (line !== "") {
            paragraph
              .editAsText()
              .setFontSize(block.size ?? 11)
              .setBold(block.bold ?? false);
          }
        }
        break;
      case "table": {
        const table = body.appendTable(block.rows.map((row) => [...row]));
        table.setBorderColor("#9aa0a6").setColumnWidth(0, 150);
        for (let r = 0; r < table.getNumRows(); r++) {
          const row = table.getRow(r);
          row.getCell(0).setBackgroundColor(LABEL_BACKGROUND).editAsText().setBold(true);
          for (let c = 0; c < row.getNumCells(); c++) {
            row.getCell(c).setPaddingTop(4).setPaddingBottom(4).editAsText().setFontSize(11);
          }
        }
        break;
      }
      case "spacer":
        body.appendParagraph("");
        break;
    }
  }
  // A new document starts with one empty paragraph; drop it.
  const first = body.getChild(0);
  if (body.getNumChildren() > 1 && first.getType() === DocumentApp.ElementType.PARAGRAPH) {
    first.removeFromParent();
  }
}
