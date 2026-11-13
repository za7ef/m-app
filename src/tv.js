// Android TV / Google TV support.
// IS_TV is true on a TV device (UI mode TELEVISION) or in the dedicated TV build (EXPO_PUBLIC_TV=1 or extra.tv in app.config.js).
import { Platform, Dimensions } from 'react-native';
import Constants from 'expo-constants';

export const IS_TV = !!Platform.isTV || process.env.EXPO_PUBLIC_TV === '1' || !!Constants.expoConfig?.extra?.tv;

const { width, height } = Dimensions.get('window');
// TV screens are landscape; size things from the short side so cards fit at 10-foot distance.
export const SCREEN_W = width;
export const SCREEN_H = height;
export const TV_RAIL_W = 88;
