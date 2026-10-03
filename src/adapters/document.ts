import { PLACEHOLDER_SOURCE } from "../core/template";

export interface PdfFile {
  id: string;
  name: string;
  url: string;
}

/** Google Docs / Drive operations needed to turn a template into a PDF. */
export interface DocumentService {
  /** Text of the body, header and footer, used to find the template's placeholders. */
  readTemplateText(templateDocId: string): string;
  /**
   * Copies the template, replaces placeholders with the given values, saves a PDF in the
   * folder and moves the temporary copy to the trash.
   */
  createPdf(params: {
    templateDocId: string;
    folderId: string;
    fileName: string;
    replacements: ReadonlyMap<string, string>;
  }): PdfFile;
}

type Section =
  | GoogleAppsScript.Document.Body
  | GoogleAppsScript.Document.HeaderSection
  | GoogleAppsScript.Document.FooterSection;

function sectionsOf(doc: GoogleAppsScript.Document.Document): Section[] {
  return [doc.getBody(), doc.getHeader(), doc.getFooter()].filter(
    (section): section is Section => section !== null,
  );
}

/**
 * Replaces placeholders literally (replaceText would treat values as regex replacements).
 * All matches are collected first and replaced from the end, so offsets stay valid and an
 * answer that itself contains "{{...}}" is never substituted again.
 */
function replacePlaceholders(section: Section, replacements: ReadonlyMap<string, string>): void {
  const matches: { text: GoogleAppsScript.Document.Text; start: number; end: number }[] = [];
  let found = section.findText(PLACEHOLDER_SOURCE);
  while (found !== null) {
    matches.push({
      text: found.getElement().asText(),
      start: found.getStartOffset(),
      end: found.getEndOffsetInclusive(),
    });
    found = section.findText(PLACEHOLDER_SOURCE, found);
  }
  for (const { text, start, end } of matches.reverse()) {
    const value = replacements.get(text.getText().slice(start, end + 1));
    if (value === undefined) continue;
    text.deleteText(start, end);
    if (value !== "") text.insertText(start, value);
  }
}

export function createGasDocumentService(): DocumentService {
  return {
    readTemplateText(templateDocId) {
      // DocumentApp only says "Invalid argument" for files that are not Google Docs.
      const mimeType = DriveApp.getFileById(templateDocId).getMimeType();
      if (mimeType === MimeType.MICROSOFT_WORD) {
        throw new Error(
          "Word 形式（.docx）のファイルです。ドキュメントを開き「ファイル」→「Google ドキュメントとして保存」で作られた新しいドキュメントの URL を設定してください",
        );
      }
      if (mimeType !== MimeType.GOOGLE_DOCS) {
        throw new Error(`Google ドキュメントではありません（ファイルの種類：${mimeType}）`);
      }
      return sectionsOf(DocumentApp.openById(templateDocId))
        .map((section) => section.getText())
        .join("\n");
    },

    createPdf({ templateDocId, folderId, fileName, replacements }) {
      const folder = DriveApp.getFolderById(folderId);
      const copy = DriveApp.getFileById(templateDocId).makeCopy(fileName, folder);
      try {
        const doc = DocumentApp.openById(copy.getId());
        for (const section of sectionsOf(doc)) replacePlaceholders(section, replacements);
        doc.saveAndClose();
        const pdf = folder.createFile(copy.getAs(MimeType.PDF).setName(`${fileName}.pdf`));
        return { id: pdf.getId(), name: pdf.getName(), url: pdf.getUrl() };
      } finally {
        copy.setTrashed(true);
      }
    },
  };
}
