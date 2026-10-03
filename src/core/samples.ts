/**
 * Ready-made use cases created from the menu: a form, a document template and settings.
 * Business details in the documents (company name, address) are placeholders for the
 * customer to edit.
 */
import type { SettingsValues } from "./settings";

export type QuestionType = "text" | "paragraph" | "email" | "number" | "date" | "choice";

export interface SampleQuestion {
  title: string;
  type: QuestionType;
  required: boolean;
  help?: string;
  /** For "choice" questions. */
  choices?: readonly string[];
}

export type Align = "left" | "center" | "right";

export type DocBlock =
  | { kind: "title"; text: string }
  | { kind: "paragraph"; text: string; align?: Align; bold?: boolean; size?: number }
  /** Two-column table of label and value; the label column is shaded. */
  | { kind: "table"; rows: readonly (readonly [string, string])[] }
  | { kind: "spacer" };

export type SampleId = "estimate" | "application" | "certificate";

export interface SampleTemplate {
  id: SampleId;
  /** Use case name shown in the menu and in file names. */
  label: string;
  formTitle: string;
  formDescription: string;
  questions: readonly SampleQuestion[];
  documentTitle: string;
  document: readonly DocBlock[];
  settings: Required<
    Pick<SettingsValues, "fileNameTemplate" | "emailFieldName" | "subjectTemplate" | "bodyTemplate">
  >;
}

const EDIT_NOTE = "（← 書き換えてください）";

const estimate: SampleTemplate = {
  id: "estimate",
  label: "見積書",
  formTitle: "見積書の作成（社内用）",
  formDescription:
    "担当者が入力すると、お客様に見積書（PDF）をメールで送付します。金額は税込・税抜とも入力してください。",
  questions: [
    { title: "会社名", type: "text", required: true, help: "お客様の会社名" },
    { title: "ご担当者名", type: "text", required: true, help: "お客様の担当者名" },
    { title: "メールアドレス", type: "email", required: true, help: "見積書の送付先" },
    { title: "件名", type: "text", required: true, help: "例：Webサイト制作" },
    {
      title: "見積内容",
      type: "paragraph",
      required: true,
      help: "品目・数量・単価などを 1 行ずつ入力してください",
    },
    { title: "小計（税抜）", type: "number", required: true, help: "数字のみ（例：100000）" },
    { title: "消費税", type: "number", required: true, help: "数字のみ（例：10000）" },
    { title: "合計金額（税込）", type: "number", required: true, help: "数字のみ（例：110000）" },
    { title: "有効期限", type: "date", required: true },
    { title: "備考", type: "paragraph", required: false },
  ],
  documentTitle: "【テンプレート】見積書",
  document: [
    { kind: "title", text: "御見積書" },
    { kind: "paragraph", text: "発行日：{{今日}}", align: "right" },
    { kind: "paragraph", text: "{{会社名}} 御中", bold: true, size: 14 },
    { kind: "paragraph", text: "{{ご担当者名}} 様" },
    { kind: "spacer" },
    { kind: "paragraph", text: "下記のとおりお見積り申し上げます。" },
    {
      kind: "table",
      rows: [
        ["件名", "{{件名}}"],
        ["お見積金額（税込）", "{{合計金額（税込）:yen}}"],
        ["有効期限", "{{有効期限:date(yyyy年M月d日)}}"],
      ],
    },
    { kind: "spacer" },
    { kind: "paragraph", text: "内訳", bold: true },
    { kind: "paragraph", text: "{{見積内容}}" },
    {
      kind: "table",
      rows: [
        ["小計（税抜）", "{{小計（税抜）:yen}}"],
        ["消費税", "{{消費税:yen}}"],
        ["合計（税込）", "{{合計金額（税込）:yen}}"],
      ],
    },
    { kind: "spacer" },
    { kind: "paragraph", text: "備考：{{備考}}" },
    { kind: "spacer" },
    { kind: "paragraph", text: `株式会社サンプル${EDIT_NOTE}`, align: "right", bold: true },
    { kind: "paragraph", text: "〒000-0000 東京都〇〇区〇〇 0-0-0", align: "right" },
    { kind: "paragraph", text: "TEL 00-0000-0000", align: "right" },
  ],
  settings: {
    fileNameTemplate: "見積書_{{会社名}}_{{今日:date(yyyyMMdd)}}",
    emailFieldName: "メールアドレス",
    subjectTemplate: "【御見積書】{{件名}}（{{会社名}} 様）",
    bodyTemplate: [
      "{{会社名}}",
      "{{ご担当者名}} 様",
      "",
      "いつもお世話になっております。",
      "ご依頼いただいた「{{件名}}」のお見積書を添付いたします。",
      "ご確認のほど、よろしくお願いいたします。",
      "",
      "株式会社サンプル",
    ].join("\n"),
  },
};

const application: SampleTemplate = {
  id: "application",
  label: "申込控え",
  formTitle: "講座お申し込みフォーム",
  formDescription: "送信後、お申し込み内容の控え（PDF）をメールでお送りします。",
  questions: [
    { title: "お名前", type: "text", required: true },
    { title: "フリガナ", type: "text", required: true },
    {
      title: "メールアドレス",
      type: "email",
      required: true,
      help: "お申し込み内容の控えをお送りします",
    },
    { title: "電話番号", type: "text", required: false },
    {
      title: "申込講座",
      type: "choice",
      required: true,
      choices: ["初級コース", "中級コース", "上級コース"],
    },
    { title: "受講形式", type: "choice", required: true, choices: ["教室", "オンライン"] },
    { title: "受講希望日", type: "date", required: true },
    { title: "ご要望・ご質問", type: "paragraph", required: false },
  ],
  documentTitle: "【テンプレート】申込控え",
  document: [
    { kind: "title", text: "お申し込み内容の控え" },
    { kind: "paragraph", text: "受付日時：{{送信日時}}", align: "right" },
    { kind: "paragraph", text: "{{お名前}} 様", bold: true, size: 14 },
    { kind: "spacer" },
    {
      kind: "paragraph",
      text: "このたびはお申し込みいただき、ありがとうございます。以下の内容で承りました。",
    },
    {
      kind: "table",
      rows: [
        ["お名前", "{{お名前}}（{{フリガナ}}）"],
        ["メールアドレス", "{{メールアドレス}}"],
        ["電話番号", "{{電話番号}}"],
        ["申込講座", "{{申込講座}}"],
        ["受講形式", "{{受講形式}}"],
        ["受講希望日", "{{受講希望日:date(yyyy年M月d日(E))}}"],
        ["ご要望・ご質問", "{{ご要望・ご質問}}"],
      ],
    },
    { kind: "spacer" },
    {
      kind: "paragraph",
      text: "内容に誤りがある場合や、キャンセルされる場合は、お手数ですがご連絡ください。",
    },
    { kind: "spacer" },
    { kind: "paragraph", text: `サンプル教室${EDIT_NOTE}`, align: "right", bold: true },
    { kind: "paragraph", text: "TEL 00-0000-0000 / info@example.com", align: "right" },
  ],
  settings: {
    fileNameTemplate: "申込控え_{{お名前}}_{{送信日時:date(yyyyMMdd_HHmm)}}",
    emailFieldName: "メールアドレス",
    subjectTemplate: "【お申し込み受付】{{申込講座}}",
    bodyTemplate: [
      "{{お名前}} 様",
      "",
      "このたびは「{{申込講座}}」にお申し込みいただき、ありがとうございます。",
      "お申し込み内容の控えを添付いたします。",
      "",
      "受講希望日：{{受講希望日:date(yyyy年M月d日(E))}}",
      "受講形式：{{受講形式}}",
      "",
      "当日お会いできることを楽しみにしております。",
      "",
      "サンプル教室",
    ].join("\n"),
  },
};

const certificate: SampleTemplate = {
  id: "certificate",
  label: "受講証明書",
  formTitle: "受講証明書の発行（社内用）",
  formDescription: "担当者が入力すると、受講者に受講証明書（PDF）をメールで送付します。",
  questions: [
    { title: "受講者氏名", type: "text", required: true },
    { title: "メールアドレス", type: "email", required: true, help: "受講証明書の送付先" },
    { title: "講座名", type: "text", required: true },
    { title: "受講開始日", type: "date", required: true },
    { title: "修了日", type: "date", required: true },
  ],
  documentTitle: "【テンプレート】受講証明書",
  document: [
    { kind: "spacer" },
    { kind: "title", text: "受講証明書" },
    { kind: "spacer" },
    { kind: "paragraph", text: "{{受講者氏名}} 殿", align: "center", bold: true, size: 18 },
    { kind: "spacer" },
    {
      kind: "paragraph",
      text: "あなたは下記の講座を修了したことを証明します。",
      align: "center",
    },
    { kind: "spacer" },
    {
      kind: "table",
      rows: [
        ["講座名", "{{講座名}}"],
        ["受講期間", "{{受講開始日:date(yyyy年M月d日)}} ～ {{修了日:date(yyyy年M月d日)}}"],
      ],
    },
    { kind: "spacer" },
    { kind: "spacer" },
    { kind: "paragraph", text: "{{今日}}", align: "right" },
    { kind: "paragraph", text: `サンプルスクール${EDIT_NOTE}`, align: "right", bold: true },
    { kind: "paragraph", text: "代表 〇〇 〇〇", align: "right" },
  ],
  settings: {
    fileNameTemplate: "受講証明書_{{講座名}}_{{受講者氏名}}",
    emailFieldName: "メールアドレス",
    subjectTemplate: "【受講証明書】{{講座名}}",
    bodyTemplate: [
      "{{受講者氏名}} 様",
      "",
      "「{{講座名}}」の修了、おめでとうございます。",
      "受講証明書を添付いたしますので、お受け取りください。",
      "",
      "サンプルスクール",
    ].join("\n"),
  },
};

export const SAMPLES: readonly SampleTemplate[] = [estimate, application, certificate];

export function findSample(id: SampleId): SampleTemplate {
  const sample = SAMPLES.find((s) => s.id === id);
  if (sample === undefined) throw new Error(`Unknown sample: ${id}`);
  return sample;
}

/** All text of the document, as it will appear in the template. */
export function documentText(blocks: readonly DocBlock[]): string {
  return blocks
    .map((block) => {
      if (block.kind === "table") return block.rows.map((row) => row.join("\t")).join("\n");
      if (block.kind === "spacer") return "";
      return block.text;
    })
    .join("\n");
}
