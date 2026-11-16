import { SymbolView as ExpoSymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

/**
 * Uygulamadaki tüm simgeler için ortak bileşen. iOS'ta Apple'ın SF Symbols
 * simgeleri, Android'de Google'ın Material Symbols karşılıkları gösterilir.
 * (expo-symbols'un SF Symbol adları Android'de çalışmadığı için - eşleştirme
 * yapılmazsa Android'de simgeler hiç görünmüyordu.)
 *
 * Kullanım eskisiyle aynı: <SymbolView name="trash" size={16} tintColor="..." />
 */
const ANDROID_MAP: Record<string, string> = {
  bell: 'notifications',
  'bubble.left.and.text.bubble.right': 'forum',
  'bubble.left.and.text.bubble.right.fill': 'forum',
  'calendar.badge.exclamationmark': 'event_busy',
  'camera.fill': 'photo_camera',
  'car.fill': 'directions_car',
  'car.side.fill': 'directions_car',
  checkmark: 'check',
  'chevron.left': 'arrow_back_ios',
  'chevron.right': 'chevron_right',
  'circle.circle.fill': 'tire_repair',
  'circle.lefthalf.filled': 'contrast',
  clock: 'history',
  'clock.fill': 'history',
  'doc.text': 'description',
  'drop.fill': 'water_drop',
  'ellipsis.circle.fill': 'more_horiz',
  'envelope.fill': 'mail',
  'exclamationmark.circle.fill': 'error',
  'exclamationmark.octagon.fill': 'report',
  eye: 'visibility',
  'gauge.with.dots.needle.33percent': 'speed',
  gearshape: 'settings',
  house: 'home',
  'house.fill': 'home',
  lifepreserver: 'support',
  'lifepreserver.fill': 'support',
  'message.fill': 'chat',
  'moon.fill': 'dark_mode',
  pencil: 'edit',
  'person.2.fill': 'group',
  'person.badge.minus': 'person_remove',
  'person.badge.plus': 'person_add',
  'person.crop.circle': 'account_circle',
  'person.crop.circle.fill': 'account_circle',
  'person.fill': 'person',
  photo: 'image',
  'photo.on.rectangle': 'photo_library',
  plus: 'add',
  'plus.circle.fill': 'add_circle',
  'square.and.arrow.down': 'download',
  'sun.max.fill': 'light_mode',
  trash: 'delete',
  'wrench.and.screwdriver': 'build',
  'wrench.and.screwdriver.fill': 'build',
  'wrench.fill': 'build',
  xmark: 'close',
};

type Props = {
  name: string;
  size?: number;
  tintColor?: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function SymbolView({ name, size, tintColor, style }: Props) {
  const symbolName = {
    ios: name,
    android: ANDROID_MAP[name] ?? 'circle',
  } as SymbolViewProps['name'];
  return <ExpoSymbolView name={symbolName} size={size} tintColor={tintColor} style={style} />;
}
