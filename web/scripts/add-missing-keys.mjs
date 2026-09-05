import fs from 'node:fs/promises'
import path from 'node:path'
const dir = path.resolve('src/i18n/locales')
const keys = {
  en: {
    Airwallex: 'Airwallex',
    'Airwallex Gateway': 'Airwallex Gateway',
    AirwallexClientID: 'Client ID',
    AirwallexAPIKey: 'API key',
    AirwallexWebhookSecret: 'Webhook secret',
    AirwallexCurrency: 'Currency',
    AirwallexUnitPrice: 'Unit price',
    AirwallexMinTopUp: 'Minimum top-up',
    'Enable Airwallex': 'Enable Airwallex',
    'Use Airwallex sandbox': 'Use Airwallex sandbox',
    'Scan the QR code to complete payment':
      'Scan the QR code to complete payment',
    Close: 'Close',
  },
  zh: {
    Airwallex: 'Airwallex',
    'Airwallex Gateway': 'Airwallex 支付',
    AirwallexClientID: '客户端 ID',
    AirwallexAPIKey: 'API 密钥',
    AirwallexWebhookSecret: 'Webhook 密钥',
    AirwallexCurrency: '货币',
    AirwallexUnitPrice: '单位价格',
    AirwallexMinTopUp: '最低充值金额',
    'Enable Airwallex': '启用 Airwallex',
    'Use Airwallex sandbox': '使用 Airwallex 沙盒',
    'Scan the QR code to complete payment': '扫描二维码完成支付',
    Close: '关闭',
  },
  'zh-TW': {
    Airwallex: 'Airwallex',
    'Airwallex Gateway': 'Airwallex 付款',
    AirwallexClientID: '用戶端 ID',
    AirwallexAPIKey: 'API 金鑰',
    AirwallexWebhookSecret: 'Webhook 金鑰',
    AirwallexCurrency: '貨幣',
    AirwallexUnitPrice: '單位價格',
    AirwallexMinTopUp: '最低儲值金額',
    'Enable Airwallex': '啟用 Airwallex',
    'Use Airwallex sandbox': '使用 Airwallex 沙盒',
    'Scan the QR code to complete payment': '掃描 QR 碼完成付款',
    Close: '關閉',
  },
  fr: {
    Airwallex: 'Airwallex',
    'Airwallex Gateway': 'Passerelle Airwallex',
    AirwallexClientID: 'ID client',
    AirwallexAPIKey: 'Clé API',
    AirwallexWebhookSecret: 'Secret webhook',
    AirwallexCurrency: 'Devise',
    AirwallexUnitPrice: 'Prix unitaire',
    AirwallexMinTopUp: 'Recharge minimale',
    'Enable Airwallex': 'Activer Airwallex',
    'Use Airwallex sandbox': 'Utiliser le bac à sable Airwallex',
    'Scan the QR code to complete payment': 'Scannez le code QR pour payer',
    Close: 'Fermer',
  },
  ja: {
    Airwallex: 'Airwallex',
    'Airwallex Gateway': 'Airwallex ゲートウェイ',
    AirwallexClientID: 'クライアント ID',
    AirwallexAPIKey: 'API キー',
    AirwallexWebhookSecret: 'Webhook シークレット',
    AirwallexCurrency: '通貨',
    AirwallexUnitPrice: '単価',
    AirwallexMinTopUp: '最低チャージ額',
    'Enable Airwallex': 'Airwallex を有効化',
    'Use Airwallex sandbox': 'Airwallex サンドボックスを使用',
    'Scan the QR code to complete payment': 'QR コードをスキャンして支払う',
    Close: '閉じる',
  },
  ru: {
    Airwallex: 'Airwallex',
    'Airwallex Gateway': 'Шлюз Airwallex',
    AirwallexClientID: 'ID клиента',
    AirwallexAPIKey: 'Ключ API',
    AirwallexWebhookSecret: 'Секрет webhook',
    AirwallexCurrency: 'Валюта',
    AirwallexUnitPrice: 'Цена единицы',
    AirwallexMinTopUp: 'Минимальное пополнение',
    'Enable Airwallex': 'Включить Airwallex',
    'Use Airwallex sandbox': 'Использовать песочницу Airwallex',
    'Scan the QR code to complete payment': 'Отсканируйте QR-код для оплаты',
    Close: 'Закрыть',
  },
  vi: {
    Airwallex: 'Airwallex',
    'Airwallex Gateway': 'Cổng Airwallex',
    AirwallexClientID: 'ID khách hàng',
    AirwallexAPIKey: 'Khóa API',
    AirwallexWebhookSecret: 'Bí mật webhook',
    AirwallexCurrency: 'Tiền tệ',
    AirwallexUnitPrice: 'Giá đơn vị',
    AirwallexMinTopUp: 'Nạp tối thiểu',
    'Enable Airwallex': 'Bật Airwallex',
    'Use Airwallex sandbox': 'Dùng sandbox Airwallex',
    'Scan the QR code to complete payment': 'Quét mã QR để hoàn tất thanh toán',
    Close: 'Đóng',
  },
}
for (const locale of Object.keys(keys)) {
  Object.assign(keys[locale], {
    'Available Balance':
      locale === 'zh'
        ? '可用余额'
        : locale === 'zh-TW'
          ? '可用餘額'
          : locale === 'fr'
            ? 'Solde disponible'
            : locale === 'ja'
              ? '利用可能残高'
              : locale === 'ru'
                ? 'Доступный баланс'
                : locale === 'vi'
                  ? 'Số dư khả dụng'
                  : 'Available Balance',
    'Ready to use across your account':
      locale === 'zh'
        ? '可在账户中使用'
        : locale === 'zh-TW'
          ? '可在帳戶中使用'
          : locale === 'fr'
            ? 'Prêt à être utilisé sur votre compte'
            : locale === 'ja'
              ? 'アカウント全体で利用できます'
              : locale === 'ru'
                ? 'Доступно для использования в аккаунте'
                : locale === 'vi'
                  ? 'Sẵn sàng sử dụng trong tài khoản'
                  : 'Ready to use across your account',
    'Scan to pay':
      locale === 'zh'
        ? '扫码支付'
        : locale === 'zh-TW'
          ? '掃碼付款'
          : locale === 'fr'
            ? 'Scanner pour payer'
            : locale === 'ja'
              ? 'スキャンして支払う'
              : locale === 'ru'
                ? 'Сканируйте для оплаты'
                : locale === 'vi'
                  ? 'Quét để thanh toán'
                  : 'Scan to pay',
    'Your payment status updates automatically.':
      locale === 'zh'
        ? '支付状态会自动更新。'
        : locale === 'zh-TW'
          ? '付款狀態會自動更新。'
          : locale === 'fr'
            ? 'Le statut du paiement se met à jour automatiquement.'
            : locale === 'ja'
              ? '支払い状況は自動的に更新されます。'
              : locale === 'ru'
                ? 'Статус платежа обновляется автоматически.'
                : locale === 'vi'
                  ? 'Trạng thái thanh toán sẽ tự động cập nhật.'
                  : 'Your payment status updates automatically.',
    'Payment QR code':
      locale === 'zh'
        ? '支付二维码'
        : locale === 'zh-TW'
          ? '付款 QR 碼'
          : locale === 'fr'
            ? 'Code QR de paiement'
            : locale === 'ja'
              ? '支払い QR コード'
              : locale === 'ru'
                ? 'QR-код платежа'
                : locale === 'vi'
                  ? 'Mã QR thanh toán'
                  : 'Payment QR code',
    'Redeem a code':
      locale === 'zh'
        ? '兑换代码'
        : locale === 'zh-TW'
          ? '兌換代碼'
          : locale === 'fr'
            ? 'Utiliser un code'
            : locale === 'ja'
              ? 'コードを利用'
              : locale === 'ru'
                ? 'Активировать код'
                : locale === 'vi'
                  ? 'Đổi mã'
                  : 'Redeem a code',
    'Apply a redemption code to your account balance.':
      locale === 'zh'
        ? '将兑换代码应用到您的账户余额。'
        : locale === 'zh-TW'
          ? '將兌換代碼套用至您的帳戶餘額。'
          : locale === 'fr'
            ? 'Appliquez un code à votre solde.'
            : locale === 'ja'
              ? 'アカウント残高にコードを適用します。'
              : locale === 'ru'
                ? 'Примените код к балансу аккаунта.'
                : locale === 'vi'
                  ? 'Áp dụng mã vào số dư tài khoản.'
                  : 'Apply a redemption code to your account balance.',
    'Account Tools':
      locale === 'zh'
        ? '账户工具'
        : locale === 'zh-TW'
          ? '帳戶工具'
          : locale === 'fr'
            ? 'Outils du compte'
            : locale === 'ja'
              ? 'アカウントツール'
              : locale === 'ru'
                ? 'Инструменты аккаунта'
                : locale === 'vi'
                  ? 'Công cụ tài khoản'
                  : 'Account Tools',
    'Open billing history':
      locale === 'zh'
        ? '打开账单记录'
        : locale === 'zh-TW'
          ? '開啟付款記錄'
          : locale === 'fr'
            ? 'Ouvrir l’historique'
            : locale === 'ja'
              ? '請求履歴を開く'
              : locale === 'ru'
                ? 'Открыть историю платежей'
                : locale === 'vi'
                  ? 'Mở lịch sử thanh toán'
                  : 'Open billing history',
    'Redemption code':
      locale === 'zh'
        ? '兑换代码'
        : locale === 'zh-TW'
          ? '兌換代碼'
          : locale === 'fr'
            ? 'Code de réduction'
            : locale === 'ja'
              ? '引き換えコード'
              : locale === 'ru'
                ? 'Код погашения'
                : locale === 'vi'
                  ? 'Mã đổi thưởng'
                  : 'Redemption code',
    'Redemption codes are currently unavailable.':
      locale === 'zh'
        ? '兑换代码目前不可用。'
        : locale === 'zh-TW'
          ? '兌換代碼目前無法使用。'
          : locale === 'fr'
            ? 'Les codes sont actuellement indisponibles.'
            : locale === 'ja'
              ? '現在コードは利用できません。'
              : locale === 'ru'
                ? 'Коды сейчас недоступны.'
                : locale === 'vi'
                  ? 'Mã đổi thưởng hiện không khả dụng.'
                  : 'Redemption codes are currently unavailable.',
    'Get a redemption code':
      locale === 'zh'
        ? '获取兑换代码'
        : locale === 'zh-TW'
          ? '取得兌換代碼'
          : locale === 'fr'
            ? 'Obtenir un code'
            : locale === 'ja'
              ? 'コードを取得'
              : locale === 'ru'
                ? 'Получить код'
                : locale === 'vi'
                  ? 'Lấy mã đổi thưởng'
                  : 'Get a redemption code',
    'Billing history':
      locale === 'zh'
        ? '账单记录'
        : locale === 'zh-TW'
          ? '付款記錄'
          : locale === 'fr'
            ? 'Historique des paiements'
            : locale === 'ja'
              ? '請求履歴'
              : locale === 'ru'
                ? 'История платежей'
                : locale === 'vi'
                  ? 'Lịch sử thanh toán'
                  : 'Billing history',
    'Review your previous payments and account transfers.':
      locale === 'zh'
        ? '查看之前的付款和账户转账。'
        : locale === 'zh-TW'
          ? '查看先前的付款與帳戶轉帳。'
          : locale === 'fr'
            ? 'Consultez vos paiements et transferts précédents.'
            : locale === 'ja'
              ? '過去の支払いとアカウント振替を確認します。'
              : locale === 'ru'
                ? 'Просматривайте предыдущие платежи и переводы.'
                : locale === 'vi'
                  ? 'Xem các khoản thanh toán và chuyển khoản trước đây.'
                  : 'Review your previous payments and account transfers.',
    'Redeeming...':
      locale === 'zh'
        ? '兑换中...'
        : locale === 'zh-TW'
          ? '兌換中...'
          : locale === 'fr'
            ? 'Utilisation...'
            : locale === 'ja'
              ? '利用中...'
              : locale === 'ru'
                ? 'Активация...'
                : locale === 'vi'
                  ? 'Đang đổi...'
                  : 'Redeeming...',
    'Payment completed':
      locale === 'zh'
        ? '支付已完成'
        : locale === 'zh-TW'
          ? '付款已完成'
          : locale === 'fr'
            ? 'Paiement terminé'
            : locale === 'ja'
              ? '支払いが完了しました'
              : locale === 'ru'
                ? 'Платеж завершен'
                : locale === 'vi'
                  ? 'Thanh toán hoàn tất'
                  : 'Payment completed',
    'Payment failed':
      locale === 'zh'
        ? '支付失败'
        : locale === 'zh-TW'
          ? '付款失敗'
          : locale === 'fr'
            ? 'Paiement échoué'
            : locale === 'ja'
              ? '支払いに失敗しました'
              : locale === 'ru'
                ? 'Платеж не выполнен'
                : locale === 'vi'
                  ? 'Thanh toán thất bại'
                  : 'Payment failed',
    'Waiting for payment...':
      locale === 'zh'
        ? '等待支付...'
        : locale === 'zh-TW'
          ? '等待付款...'
          : locale === 'fr'
            ? 'En attente du paiement...'
            : locale === 'ja'
              ? '支払いを待っています...'
              : locale === 'ru'
                ? 'Ожидание платежа...'
                : locale === 'vi'
                  ? 'Đang chờ thanh toán...'
                  : 'Waiting for payment...',
    'FX & Credit Currency':
      locale === 'zh'
        ? '汇率与计费货币'
        : locale === 'zh-TW'
          ? '匯率與計費貨幣'
          : locale === 'fr'
            ? 'Devise FX et crédit'
            : locale === 'ja'
              ? '為替とクレジット通貨'
              : locale === 'ru'
                ? 'Валюты FX и кредита'
                : locale === 'vi'
                  ? 'Tiền tệ FX và tín dụng'
                  : 'FX & Credit Currency',
    'FX provider':
      locale === 'zh'
        ? '汇率提供商'
        : locale === 'zh-TW'
          ? '匯率提供者'
          : locale === 'fr'
            ? 'Fournisseur FX'
            : locale === 'ja'
              ? '為替プロバイダー'
              : locale === 'ru'
                ? 'Провайдер FX'
                : locale === 'vi'
                  ? 'Nhà cung cấp FX'
                  : 'FX provider',
    'FX base currency':
      locale === 'zh'
        ? '汇率基础货币'
        : locale === 'zh-TW'
          ? '匯率基礎貨幣'
          : locale === 'fr'
            ? 'Devise de base FX'
            : locale === 'ja'
              ? '為替基準通貨'
              : locale === 'ru'
                ? 'Базовая валюта FX'
                : locale === 'vi'
                  ? 'Tiền tệ cơ sở FX'
                  : 'FX base currency',
    'Credit currency':
      locale === 'zh'
        ? '计费货币'
        : locale === 'zh-TW'
          ? '計費貨幣'
          : locale === 'fr'
            ? 'Devise de crédit'
            : locale === 'ja'
              ? 'クレジット通貨'
              : locale === 'ru'
                ? 'Валюта кредита'
                : locale === 'vi'
                  ? 'Tiền tệ tín dụng'
                  : 'Credit currency',
    'Direct credit conversion rules':
      locale === 'zh'
        ? '直接计费转换规则'
        : locale === 'zh-TW'
          ? '直接計費轉換規則'
          : locale === 'fr'
            ? 'Règles de conversion directe du crédit'
            : locale === 'ja'
              ? '直接クレジット換算ルール'
              : locale === 'ru'
                ? 'Правила прямой конвертации кредита'
                : locale === 'vi'
                  ? 'Quy tắc chuyển đổi tín dụng trực tiếp'
                  : 'Direct credit conversion rules',
  })
}
for (const [locale, values] of Object.entries(keys)) {
  const file = path.join(dir, `${locale}.json`)
  const json = JSON.parse(await fs.readFile(file, 'utf8'))
  Object.assign(json.translation, values)
  json.translation = Object.fromEntries(
    Object.entries(json.translation).sort(([a], [b]) => a.localeCompare(b))
  )
  await fs.writeFile(file, JSON.stringify(json, null, 2) + '\n')
}
