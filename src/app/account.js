import React, { useEffect, useState } from 'react';
import { View, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Animated, { FadeInDown, FadeIn, LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useStore, useTheme } from '../store';
import { Txt, Row, Btn, Glass, Press, IconBtn } from '../components/ui';
import { signIn, signUp, resetPassword, signInGoogle, authErrorKey } from '../firebase';
import { GOOGLE } from '../firebaseConfig';
import { t } from '../i18n';

WebBrowser.maybeCompleteAuthSession();
const googleOn = Platform.OS === 'android' ? !!GOOGLE.androidClientId : !!GOOGLE.iosClientId;

export default function Account() {
  const th = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setSetting, user } = useStore();
  const [mode, setMode] = useState('signin'); // signin | signup | reset
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }

  const done = () => { setSetting('accountPrompted', true); if (router.canGoBack()) router.back(); };
  useEffect(() => { if (user) done(); }, [user?.uid]);

  const submit = async () => {
    setMsg(null);
    if (!/\S+@\S+\.\S+/.test(email)) { setMsg({ ok: false, text: t('errEmail') }); return; }
    if (mode !== 'reset' && pass.length < 6) { setMsg({ ok: false, text: t('errWeak') }); return; }
    setBusy(true);
    try {
      if (mode === 'reset') { await resetPassword(email); setMsg({ ok: true, text: t('resetSent') }); }
      else if (mode === 'signup') await signUp(email, pass);
      else await signIn(email, pass);
    } catch (e) { setMsg({ ok: false, text: t(authErrorKey(e)) }); }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <LinearGradient colors={[th.accent + '55', 'transparent']} style={[StyleSheet.absoluteFill, { height: 380 }]} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 30, paddingBottom: 40, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
          <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center' }}>
            <Image source={require('../../assets/mark.png')} style={{ width: 96, height: 96 }} />
            <Txt bold center size={26} style={{ marginTop: 10 }}>
              {mode === 'signup' ? t('createAccount') : mode === 'reset' ? t('resetPass') : t('signInTitle')}
            </Txt>
            <Txt sub center size={14} style={{ marginTop: 6, lineHeight: 21 }}>{t('accountWhy')}</Txt>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(450)} layout={LinearTransition}>
            <Glass radius={24} style={{ marginTop: 26, padding: 16, gap: 12 }}>
              <Field icon="mail-outline" value={email} onChange={setEmail} ph={t('email')} type="email" />
              {mode !== 'reset' ? <Field icon="lock-closed-outline" value={pass} onChange={setPass} ph={t('password')} secure /> : null}
              {msg ? (
                <Row gap={6}>
                  <Ionicons name={msg.ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={msg.ok ? '#30D158' : '#FF453A'} />
                  <Txt size={13} style={{ flex: 1 }}>{msg.text}</Txt>
                </Row>
              ) : null}
              <Btn title={busy ? '' : mode === 'signup' ? t('createAccount') : mode === 'reset' ? t('sendReset') : t('signInBtn')} icon={busy ? undefined : 'arrow-forward'}
                onPress={submit} disabled={busy} />
              {busy ? <ActivityIndicator color={th.accent} style={{ position: 'absolute', alignSelf: 'center', bottom: 30 }} /> : null}
              {mode === 'signin' ? (
                <Press onPress={() => { setMode('reset'); setMsg(null); }}><Txt center size={14} style={{ color: th.accent }}>{t('forgotPass')}</Txt></Press>
              ) : null}
            </Glass>
          </Animated.View>

          {googleOn && mode !== 'reset' ? <GoogleButton onError={(k) => setMsg({ ok: false, text: t(k) })} /> : null}

          <Row gap={6} style={{ justifyContent: 'center', marginTop: 22 }}>
            <Txt sub size={14}>{mode === 'signin' ? t('noAccount') : t('haveAccount')}</Txt>
            <Press onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg(null); }}>
              <Txt bold size={14} style={{ color: th.accent }}>{mode === 'signin' ? t('createAccount') : t('signInBtn')}</Txt>
            </Press>
          </Row>

          <Press onPress={done} style={{ marginTop: 26 }}>
            <Txt center sub size={15}>{t('continueLocal')}</Txt>
          </Press>
          <Txt dim center size={12} style={{ marginTop: 8, lineHeight: 18 }}>{t('localNote')}</Txt>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function GoogleButton({ onError }) {
  const [req, res, prompt] = Google.useIdTokenAuthRequest({ iosClientId: GOOGLE.iosClientId, androidClientId: GOOGLE.androidClientId || undefined, webClientId: GOOGLE.webClientId || undefined });
  useEffect(() => {
    if (res?.type === 'success') {
      const { id_token, access_token } = res.params || {};
      signInGoogle(id_token, access_token || res.authentication?.accessToken).catch((e) => onError(authErrorKey(e)));
    } else if (res?.type === 'error') onError('errGoogle');
  }, [res]);
  return (
    <Press onPress={() => prompt().catch(() => onError('errGoogle'))} disabled={!req} style={{ marginTop: 14 }}>
      <Glass radius={16} interactive>
        <Row gap={10} style={{ justifyContent: 'center', paddingVertical: 14 }}>
          <Ionicons name="logo-google" size={20} color="#fff" />
          <Txt bold size={16}>{t('withGoogle')}</Txt>
        </Row>
      </Glass>
    </Press>
  );
}

function Field({ icon, value, onChange, ph, secure, type }) {
  const th = useTheme();
  const [show, setShow] = useState(false);
  return (
    <Glass radius={14}>
      <Row gap={8} style={{ paddingHorizontal: 12 }}>
        <Ionicons name={icon} size={18} color={th.sub} />
        <TextInput value={value} onChangeText={onChange} placeholder={ph} placeholderTextColor={th.dim}
          secureTextEntry={secure && !show} autoCapitalize="none" autoCorrect={false}
          keyboardType={type === 'email' ? 'email-address' : 'default'} textContentType={type === 'email' ? 'emailAddress' : secure ? 'password' : 'none'}
          autoComplete={type === 'email' ? 'email' : secure ? 'password' : 'off'}
          style={{ flex: 1, color: th.text, fontSize: 16, paddingVertical: 13, textAlign: 'left', writingDirection: 'ltr' }} />
        {secure ? <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={19} color={th.sub} onPress={() => setShow(!show)} /> : null}
      </Row>
    </Glass>
  );
}
