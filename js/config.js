/*
  Настройки сайта.
  workerUrl — адрес Cloudflare Worker, который пересылает заявки в Telegram
  (инструкция в README.md, раздел «Заявки в Telegram»).
  Пока адрес пустой, форма предлагает позвонить по телефону.
*/
window.PODOLINE_CONFIG = {
workerUrl: 'https://anakensky-podoline-api-4522.twc1.net/lead'
};
