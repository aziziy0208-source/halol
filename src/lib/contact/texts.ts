import type { SiteLang } from "@/i18n/site";

/** Contact form feedback (validation and result messages) per site language. */
const TEXTS = {
  de: {
    nameRequired: "Bitte geben Sie Ihren Namen ein.",
    nameTooLong: "Der Name ist zu lang.",
    emailTooLong: "Die E-Mail-Adresse ist zu lang.",
    emailInvalid: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
    messageTooShort: "Bitte geben Sie eine Nachricht ein (mindestens 10 Zeichen).",
    messageTooLong: "Die Nachricht ist zu lang (maximal 5000 Zeichen).",
    checkInput: "Bitte prüfen Sie Ihre Eingaben.",
    tooMany: "Sie haben zu viele Nachrichten gesendet. Bitte versuchen Sie es später erneut.",
    success: "Vielen Dank! Ihre Nachricht wurde gesendet. Wir melden uns so bald wie möglich.",
  },
  en: {
    nameRequired: "Please enter your name.",
    nameTooLong: "The name is too long.",
    emailTooLong: "The e-mail address is too long.",
    emailInvalid: "Please enter a valid e-mail address.",
    messageTooShort: "Please enter a message (at least 10 characters).",
    messageTooLong: "The message is too long (maximum 5000 characters).",
    checkInput: "Please check your input.",
    tooMany: "You have sent too many messages. Please try again later.",
    success: "Thank you! Your message has been sent. We will get back to you as soon as possible.",
  },
} as const;

export function contactTexts(lang: SiteLang) {
  return TEXTS[lang];
}
