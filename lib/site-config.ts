/**
 * Единое место для настроек, которые владелец проекта может менять,
 * не трогая компоненты: названия, даты, демо-изображения, категории.
 */

export const siteConfig = {
  name: "Our Private Universe",
  coupleTitle: "Имя × Имя",
  tagline: "Две судьбы. Тысячи моментов. Одна история",
  monogram: "A × B",

  /** Дата знакомства — календарная дата (без времени). Замените на свою. */
  meetingDate: { year: 2020, month: 1, day: 1 },

  /** Дата начала отношений — от неё идёт счётчик. Замените на свою. */
  startDate: { year: 2020, month: 6, day: 1 },

  /**
   * Часовой пояс (IANA), по которому считается «сегодня» и границы суток.
   * Меняется через NEXT_PUBLIC_TIMEZONE. Счётчик использует календарную
   * арифметику в этом поясе, поэтому не зависит от часового пояса браузера.
   */
  defaultTimezone: "UTC",

  /**
   * Личные фотографии для первого экрана и блока «Наша история».
   * Пока владелец не добавил файл (положите его в /public и впишите путь),
   * показывается абстрактный ночной фон — без демонстрационных картинок.
   */
  images: {
    hero: null as string | null,
    story: null as string | null,
  },
} as const;

/** Подсказки категорий воспоминаний (пользователь может ввести и свою). */
export const memoryCategorySuggestions = [
  "Путешествия",
  "Праздники",
  "Повседневность",
  "Места",
  "Разное",
] as const;

export const DEFAULT_MEMORY_CATEGORY = "Разное";

export type NavItem = {
  href: string;
  label: string;
  /** Раздел требует входа. */
  private: boolean;
};

export const navItems: readonly NavItem[] = [
  { href: "/#story", label: "Наша история", private: false },
  { href: "/memories", label: "Воспоминания", private: true },
  { href: "/timeline", label: "Timeline", private: true },
  { href: "/letters", label: "Письма", private: true },
  { href: "/archive", label: "Архив", private: true },
] as const;

/** Пути, требующие входа (используется в proxy и в клиентской навигации). */
export const PRIVATE_PATH_PREFIXES = [
  "/memories",
  "/timeline",
  "/letters",
  "/archive",
] as const;
