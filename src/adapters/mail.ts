export interface MailMessage {
  to: readonly string[];
  subject: string;
  body: string;
  /** Drive file IDs to attach. */
  attachmentFileIds?: readonly string[];
}

export interface Mailer {
  send(message: MailMessage): void;
  /** How many more emails can be sent today. */
  remainingDailyQuota(): number;
  /** Address of the account the script runs as; receives errors when no staff is set. */
  ownerEmail(): string;
}

export function createGasMailer(): Mailer {
  return {
    send({ to, subject, body, attachmentFileIds = [] }) {
      MailApp.sendEmail({
        to: to.join(","),
        subject,
        body,
        attachments: attachmentFileIds.map((id) => DriveApp.getFileById(id).getBlob()),
      });
    },
    remainingDailyQuota: () => MailApp.getRemainingDailyQuota(),
    ownerEmail: () => Session.getEffectiveUser().getEmail(),
  };
}
