import { useEffect, useMemo, useState, useRef } from 'react';
import './App.css';
import { createQrDataUrl } from './services/qrImage';
import { toKioskProfile } from './services/qrProfile';
import healthCatalog from './services/healthCatalog.json';
import { getProfileStorageKey, loadUserProfile, saveUserProfile } from './services/profileStorage';
import {
  createAppUser,
  deleteVendingMachine,
  findAppAdmin,
  findAppUser,
  getHealthProfile,
  getPurchaseHistory,
  getVendingMachines,
  isHealthDbConfigured,
  mapDbMachineToAppMachine,
  mapDbProfileToAppProfile,
  saveHealthProfile,
  saveVendingMachine,
} from './services/healthDb';

const USERS_KEY = 'health-app-users-v1';
const SESSION_KEY = 'health-app-session-v1';
const KIOSK_PROFILE_KEY = 'health-app-kiosk-profile-v1';
const VENDING_MACHINES_KEY = 'health-app-vending-machines-v1';
const KAKAO_MAP_KEY = import.meta.env.VITE_KAKAO_MAP_KEY?.trim() || '';
const KAKAO_MAP_SDK_URL = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_MAP_KEY)}&autoload=false&libraries=services`;
const KAKAO_MAP_SCRIPT_ID = 'kakao-map-sdk';
const MAP_START_POINT = { lat: 36.624618, lng: 127.483255 };

const DEFAULT_VENDING_MACHINES = [
  {
    id: 'vm-001',
    name: '영양제 자판기 1',
    address: '서일대학교 정문 인근',
    lat: 37.5869,
    lng: 127.0978,
    status: '운영중',
  },
  {
    id: 'vm-002',
    name: '영양제 자판기 2',
    address: '서일대학교 후문 인근',
    lat: 37.5856,
    lng: 127.0957,
    status: '운영중',
  },
  {
    id: 'vm-003',
    name: '영양제 자판기 3',
    address: '서원대학교 인근',
    lat: 36.6252,
    lng: 127.4822,
    status: '운영중',
  },
];

const EMPTY_MACHINE_FORM = {
  id: '',
  name: '',
  address: '',
  lat: '',
  lng: '',
  status: '운영중',
};

const DEFAULT_PROFILE = {
  name: '',
  age: '',
  height: '',
  weight: '',
  gender: '',
  smoking: '',
  alcohol: '',
  conditions: ['해당 없음'],
  allergies: '해당 없음',
  medications: '해당 없음',
};

const DISEASES = Object.keys(healthCatalog.conditions).filter((name) => name !== '해당 없음');
const REQUIRED_FIELDS = ['name', 'age', 'height', 'weight', 'gender', 'smoking', 'alcohol', 'allergies', 'medications'];
const ALLERGY_OPTIONS = [...Object.keys(healthCatalog.allergies), '직접 입력'];
const MEDICATION_OPTIONS = [...Object.keys(healthCatalog.medications), '직접 입력'];

const CHOICE_SCREEN_CONFIG = {
  allergy: {
    title: '알러지 선택',
    eyebrow: '건강 데이터',
    label: '알러지',
    options: ALLERGY_OPTIONS,
    field: 'allergies',
  },
  medication: {
    title: '복용약물 선택',
    eyebrow: '건강 데이터',
    label: '복용약물',
    options: MEDICATION_OPTIONS,
    field: 'medications',
  },
};

const loadJson = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const toNumberText = (value) => String(value ?? '').replace(/\D/g, '');

const loadKakaoMapSdk = () => new Promise((resolve, reject) => {
  if (!KAKAO_MAP_KEY) {
    reject(new Error('카카오맵 JavaScript 키가 없습니다.'));
    return;
  }

  if (window.kakao?.maps) {
    resolve(window.kakao);
    return;
  }

  const handleLoad = () => {
    if (window.kakao?.maps) {
      resolve(window.kakao);
    } else {
      reject(new Error('카카오맵 SDK가 로드됐지만 지도 객체를 찾지 못했습니다.'));
    }
  };

  const handleError = () => {
    const failedScript = document.getElementById(KAKAO_MAP_SCRIPT_ID);
    failedScript?.remove();
    reject(new Error('지도를 불러오지 못했습니다.'));
  };

  const existingScript = document.getElementById(KAKAO_MAP_SCRIPT_ID);
  if (existingScript) {
    if (existingScript.src !== new URL(KAKAO_MAP_SDK_URL).href) {
      existingScript.remove();
    } else {
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }
  }

  const script = document.createElement('script');
  script.id = KAKAO_MAP_SCRIPT_ID;
  script.src = KAKAO_MAP_SDK_URL;
  script.async = true;
  script.onload = handleLoad;
  script.onerror = handleError;
  document.head.appendChild(script);
});


const validateHealthInfo = (profile) => {
  const missing = REQUIRED_FIELDS.some((key) => !String(profile[key] ?? '').trim());
  if (missing) return '건강정보를 모두 입력해야 이용할 수 있습니다.';
  if (profile.name.length > 100) return '이름은 100자 이내로 입력해주세요.';

  const age = Number(profile.age);
  const height = Number(profile.height);
  const weight = Number(profile.weight);

  if (!Number.isInteger(age) || age < 1 || age > 120) return '나이는 1~120 사이 숫자로 입력해주세요.';
  if (!Number.isInteger(height) || height < 80 || height > 230) return '키는 80~230cm 사이 숫자로 입력해주세요.';
  if (!Number.isInteger(weight) || weight < 20 || weight > 200) return '체중은 20~200kg 사이 숫자로 입력해주세요.';
  return '';
};

function App() {
  const sessionEpoch = useRef(0);
  const saveTimer = useRef(null);
  const authPending = useRef(false);
  const savePending = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => () => { sessionEpoch.current += 1; clearTimeout(saveTimer.current); }, []);
  const [users, setUsers] = useState(() => loadJson(USERS_KEY, []));
  const [session, setSession] = useState(() => loadJson(SESSION_KEY, null));
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', userId: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [screen, setScreen] = useState(() => {
    const currentSession = loadJson(SESSION_KEY, null);
    if (!currentSession) return 'auth';
    return currentSession.isAdmin ? 'admin' : validateHealthInfo(loadUserProfile(localStorage, currentSession.userId, DEFAULT_PROFILE)) ? 'health' : 'home';
  });
  const [profile, setProfile] = useState(() => {
    const currentSession = loadJson(SESSION_KEY, null);
    return loadUserProfile(localStorage, currentSession?.userId, DEFAULT_PROFILE);
  });
  const [savedNotice, setSavedNotice] = useState('');
  const [healthError, setHealthError] = useState('');
  const [qrRefresh, setQrRefresh] = useState(0);
  const [qrImage, setQrImage] = useState('');
  const [qrError, setQrError] = useState('');
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [mapStatus, setMapStatus] = useState('');
  const [vendingMachines, setVendingMachines] = useState(() => loadJson(VENDING_MACHINES_KEY, DEFAULT_VENDING_MACHINES));
  const [machineForm, setMachineForm] = useState(EMPTY_MACHINE_FORM);
  const [machineNotice, setMachineNotice] = useState('');
  const [machineError, setMachineError] = useState('');
  const [allergyMode, setAllergyMode] = useState(() =>
    ALLERGY_OPTIONS.includes(profile.allergies) ? profile.allergies : '직접 입력'
  );
  const [medicationMode, setMedicationMode] = useState(() =>
    MEDICATION_OPTIONS.includes(profile.medications) ? profile.medications : '직접 입력'
  );
  const [needsHealthSetup, setNeedsHealthSetup] = useState(() => {
    const currentSession = loadJson(SESSION_KEY, null);
    return Boolean(currentSession && !currentSession.isAdmin && validateHealthInfo(loadUserProfile(localStorage, currentSession.userId, DEFAULT_PROFILE)));
  });

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [session]);

  useEffect(() => {
    localStorage.setItem(VENDING_MACHINES_KEY, JSON.stringify(vendingMachines));
  }, [vendingMachines]);

  useEffect(() => {
    if (!session?.userId || !isHealthDbConfigured) return;
    getVendingMachines()
      .then((rows) => {
        if (rows.length) setVendingMachines(rows.map(mapDbMachineToAppMachine));
      })
      .catch(() => {});
  }, [session?.userId]);

  const conditionText = useMemo(() => {
    if (!profile.conditions?.length) return '해당 없음';
    return profile.conditions.join(', ');
  }, [profile.conditions]);

  const setupScreens = ['health', 'disease', 'allergy', 'medication'];
  const activeScreen = !session ? 'auth' : needsHealthSetup && !session.isAdmin && !setupScreens.includes(screen)
    ? 'health' : session?.isAdmin
    ? 'admin'
    : screen === 'admin'
      ? (session ? 'home' : 'auth')
      : screen;

  const kioskProfile = useMemo(
    () => toKioskProfile(profile, session?.userId),
    [profile, session?.userId]
  );

  const qrPayload = useMemo(
    () => JSON.stringify(kioskProfile),
    [kioskProfile]
  );

  useEffect(() => {
    if (activeScreen !== 'qr') return;
    let cancelled = false;
    createQrDataUrl(qrPayload).then((url) => {
      if (!cancelled) { setQrImage(url); setQrError(''); }
    }).catch((error) => {
      if (!cancelled) { setQrImage(''); setQrError(error.message); }
    });
    return () => { cancelled = true; };
  }, [activeScreen, qrPayload, qrRefresh]);

  const historyPassword = users.find((user) => user.userId === session?.userId)?.password;
  useEffect(() => {
    if (activeScreen !== 'history' || !session?.userId) return;
    let cancelled = false;
    getPurchaseHistory(session.userId, historyPassword).then((rows) => {
      if (!cancelled) { setPurchaseHistory(rows); setHistoryError(''); }
    }).catch((error) => {
      if (!cancelled) { setPurchaseHistory([]); setHistoryError(error.message); }
    }).finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [activeScreen, session?.userId, historyPassword, historyRefresh]);

  const openHistory = () => {
    setPurchaseHistory([]); setHistoryError(''); setHistoryLoading(true); setScreen('history');
  };
  const openQr = () => {
    setQrImage(''); setQrError(''); setScreen('qr');
  };

  useEffect(() => {
    if (activeScreen !== 'map') return undefined;

    const mapElement = document.getElementById('kakao-map');
    if (!mapElement) return undefined;

    let cancelled = false;
    const renderMap = async () => {
      try {
        const kakao = await loadKakaoMapSdk();
        if (cancelled) return;
        kakao.maps.load(() => {
          if (cancelled) return;
          const center = new kakao.maps.LatLng(MAP_START_POINT.lat, MAP_START_POINT.lng);
          const map = new kakao.maps.Map(mapElement, {
            center,
            level: 4,
          });

          vendingMachines.forEach((machine) => {
            const position = new kakao.maps.LatLng(machine.lat, machine.lng);
            new kakao.maps.Marker({
              map,
              position,
              title: machine.name,
            });
          });

          setMapStatus('');
        });
      } catch (error) {
        if (!cancelled) setMapStatus(error.message);
      }
    };

    renderMap();

    return () => {
      cancelled = true;
    };
  }, [activeScreen, vendingMachines]);

  useEffect(() => {
    if (activeScreen !== 'admin') return undefined;

    const pickerElement = document.getElementById('admin-location-map');
    if (!pickerElement) return undefined;

    let cancelled = false;
    const renderPicker = async () => {
      try {
        const kakao = await loadKakaoMapSdk();
        if (cancelled) return;
        kakao.maps.load(() => {
          if (cancelled) return;
          const startLat = Number(machineForm.lat) || MAP_START_POINT.lat;
          const startLng = Number(machineForm.lng) || MAP_START_POINT.lng;
          const startPosition = new kakao.maps.LatLng(startLat, startLng);
          const center = new kakao.maps.LatLng(MAP_START_POINT.lat, MAP_START_POINT.lng);
          const pickerMap = new kakao.maps.Map(pickerElement, {
            center,
            level: 4,
          });
          const pickerMarker = new kakao.maps.Marker({
            map: pickerMap,
            position: startPosition,
          });
          const geocoder = kakao.maps.services ? new kakao.maps.services.Geocoder() : null;

          kakao.maps.event.addListener(pickerMap, 'click', (mouseEvent) => {
            const position = mouseEvent.latLng;
            const lat = position.getLat().toFixed(6);
            const lng = position.getLng().toFixed(6);
            pickerMarker.setPosition(position);
            setMachineForm((prev) => ({
              ...prev,
              lat,
              lng,
              address: prev.address || `선택 위치 (${lat}, ${lng})`,
            }));

            if (!geocoder) return;
            geocoder.coord2Address(position.getLng(), position.getLat(), (result, status) => {
              if (status !== kakao.maps.services.Status.OK || !result[0]) return;
              const roadAddress = result[0].road_address?.address_name;
              const jibunAddress = result[0].address?.address_name;
              setMachineForm((prev) => ({
                ...prev,
                address: roadAddress || jibunAddress || prev.address,
              }));
            });
          });
        });
      } catch (error) {
        if (!cancelled) setMachineNotice(error.message);
      }
    };

    renderPicker();

    return () => {
      cancelled = true;
    };
  }, [activeScreen, machineForm.id, machineForm.lat, machineForm.lng]);

  const updateProfile = (key, value) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const getProfileKey = getProfileStorageKey;

  const startAdminSession = (user) => {
    sessionEpoch.current += 1;
    setSession({ userId: user.userId, name: user.name, isAdmin: true });
    setNeedsHealthSetup(false);
    setMachineNotice('');
    setScreen('admin');
  };

  const startSession = async (user, forceHealthSetup = false) => {
    const epoch = ++sessionEpoch.current;
    let userProfile = loadJson(getProfileKey(user.userId), null);
    let nextProfile = userProfile ? { ...DEFAULT_PROFILE, ...userProfile } : { ...DEFAULT_PROFILE, name: user.name };
    let needsSetup = forceHealthSetup || !userProfile;

    if (isHealthDbConfigured) {
      try {
        const dbProfile = await getHealthProfile(user.userId);
        if (dbProfile) {
          nextProfile = mapDbProfileToAppProfile(dbProfile, { ...DEFAULT_PROFILE, name: user.name });
          userProfile = nextProfile;
          needsSetup = Boolean(validateHealthInfo(nextProfile));
          localStorage.setItem(getProfileKey(user.userId), JSON.stringify(nextProfile));
        } else if (!forceHealthSetup) {
          needsSetup = true;
        }
      } catch {
        // DB 조회가 실패해도 로컬 저장값으로 계속 진행합니다.
      }
    }

    if (epoch !== sessionEpoch.current) return;
    needsSetup = needsSetup || Boolean(validateHealthInfo(nextProfile));
    setProfile(nextProfile);
    setAllergyMode(ALLERGY_OPTIONS.includes(nextProfile.allergies) ? nextProfile.allergies : '직접 입력');
    setMedicationMode(MEDICATION_OPTIONS.includes(nextProfile.medications) ? nextProfile.medications : '직접 입력');
    setSession({ userId: user.userId, name: user.name, needsHealthSetup: needsSetup });
    setNeedsHealthSetup(needsSetup);
    setScreen(needsSetup ? 'health' : 'home');
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    if (authPending.current) return;
    authPending.current = true;
    try {
    setAuthError('');

    const userId = authForm.userId.trim();
    const password = authForm.password.trim();
    const name = authForm.name.trim();

    if (!userId || !password || (authMode === 'signup' && !name)) {
      setAuthError('필수 항목을 입력해주세요.');
      return;
    }
    if (userId.length > 100 || name.length > 100) { setAuthError('이름과 아이디는 100자 이내로 입력해주세요.'); return; }

    if (authMode === 'signup') {
      try {
        if (isHealthDbConfigured) {
          const existing = await findAppUser(userId);
          if (existing) {
            setAuthError('이미 가입된 아이디입니다.');
            return;
          }
          await createAppUser({ userId, password, name });
        } else if (users.some((user) => user.userId === userId)) {
          setAuthError('이미 가입된 아이디입니다.');
          return;
        }
      } catch {
        if (users.some((user) => user.userId === userId)) {
          setAuthError('이미 가입된 아이디입니다.');
          return;
        }
      }

      const newUser = { userId, password, name };
      setUsers((prev) => (prev.some((user) => user.userId === userId) ? prev : [...prev, newUser]));
      await startSession(newUser, true);
      return;
    }

    let found = users.find((user) => user.userId === userId && user.password === password);
    let isAdminLogin = userId === 'admin';
    if (isHealthDbConfigured) {
      try {
        const dbUser = await findAppUser(userId);
        if (dbUser && dbUser.password === password) {
          found = { userId: dbUser.user_id, password: dbUser.password, name: dbUser.name };
          setUsers((prev) => [...prev.filter((user) => user.userId !== found.userId), found]);
          isAdminLogin = Boolean(await findAppAdmin(userId));
        }
      } catch {
        // DB 로그인이 실패해도 로컬 계정으로 확인합니다.
      }
    }

    if (!found) {
      setAuthError('아이디 또는 비밀번호가 맞지 않습니다.');
      return;
    }
    if (isAdminLogin) {
      startAdminSession(found);
      return;
    }
    await startSession(found, false);
    } finally { authPending.current = false; }
  };

  const logout = () => {
    sessionEpoch.current += 1;
    clearTimeout(saveTimer.current);
    savePending.current = false;
    setIsSaving(false);
    setSession(null);
    setProfile({ ...DEFAULT_PROFILE });
    setPurchaseHistory([]);
    setHistoryError('');
    setQrImage('');
    setQrError('');
    setSavedNotice('');
    setHealthError('');
    setNeedsHealthSetup(false);
    setAuthMode('login');
    setAuthForm((prev) => ({ ...prev, password: '' }));
    setScreen('auth');
  };

  const toggleDisease = (disease) => {
    setProfile((prev) => {
      const current = prev.conditions?.filter((item) => item !== '해당 없음') || [];
      const next = current.includes(disease)
        ? current.filter((item) => item !== disease)
        : [...current, disease];
      return { ...prev, conditions: next.length ? next : ['해당 없음'] };
    });
  };

  const updateChoiceOption = (type, value) => {
    const config = CHOICE_SCREEN_CONFIG[type];
    if (!config) return;

    if (type === 'allergy') setAllergyMode(value);
    if (type === 'medication') setMedicationMode(value);

    if (value === '직접 입력') {
      return;
    }
    const selected = String(profile[config.field] || '').split(',').map((item) => item.trim()).filter((item) => item && item !== '해당 없음');
    const next = value === '해당 없음' ? [] : selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    updateProfile(config.field, next.length ? next.join(', ') : '해당 없음');
  };

  const saveHealthInfo = async () => {
    if (savePending.current || !session) return;
    const validationMessage = validateHealthInfo(profile);
    if (validationMessage) {
      setHealthError(validationMessage);
      return;
    }
    setHealthError('');
    const epoch = sessionEpoch.current;
    savePending.current = true;
    setIsSaving(true);
    try {
    saveUserProfile(localStorage, session.userId, profile);
    localStorage.setItem(`${KIOSK_PROFILE_KEY}-${session.userId}`, JSON.stringify(toKioskProfile(profile, session.userId)));
    if (isHealthDbConfigured) {
      try {
        await saveHealthProfile({
          userId: session.userId,
          profile,
          kioskPayload: toKioskProfile(profile, session.userId),
        });
      } catch {
        if (epoch !== sessionEpoch.current) return;
        setSavedNotice('이 기기에 저장했습니다. 클라우드 저장에 실패해 다른 기기에서는 보이지 않을 수 있습니다.');
        setHealthError('클라우드 연결을 확인하고 다시 저장해주세요.');
        return;
      }
    }
    if (epoch !== sessionEpoch.current) return;
    const nextSession = { ...session, name: profile.name, needsHealthSetup: false };
    setSession(nextSession);
    setNeedsHealthSetup(false);
    setSavedNotice('저장되었습니다');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (epoch !== sessionEpoch.current) return;
      setSavedNotice('');
      setScreen('home');
    }, 800);
    } finally {
      if (epoch === sessionEpoch.current) { savePending.current = false; setIsSaving(false); }
    }
  };

  const editMachine = (machine) => {
    setMachineForm({
      ...machine,
      lat: String(machine.lat),
      lng: String(machine.lng),
    });
    setMachineError('');
    setMachineNotice('');
  };

  const clearMachineForm = () => {
    setMachineForm(EMPTY_MACHINE_FORM);
    setMachineError('');
  };

  const submitMachine = async () => {
    const id = machineForm.id.trim() || `vm-${Date.now()}`;
    const nextMachine = {
      id,
      name: machineForm.name.trim(),
      address: machineForm.address.trim(),
      lat: Number(machineForm.lat),
      lng: Number(machineForm.lng),
      status: machineForm.status,
    };

    if (!nextMachine.name || !nextMachine.address) {
      setMachineError('자판기 이름과 위치 설명을 입력해주세요.');
      return;
    }
    if (!Number.isFinite(nextMachine.lat) || !Number.isFinite(nextMachine.lng)) {
      setMachineError('위도와 경도는 숫자로 입력해주세요.');
      return;
    }

    setVendingMachines((prev) => {
      const exists = prev.some((machine) => machine.id === id);
      return exists
        ? prev.map((machine) => (machine.id === id ? nextMachine : machine))
        : [...prev, nextMachine];
    });

    if (isHealthDbConfigured) {
      try {
        await saveVendingMachine(nextMachine);
        setMachineNotice('자판기 정보가 저장되었습니다.');
      } catch {
        setMachineNotice('자판기 정보가 저장되었습니다.');
      }
    } else {
      setMachineNotice('자판기 정보가 저장되었습니다.');
    }

    clearMachineForm();
  };

  const removeMachine = async (machineId) => {
    setVendingMachines((prev) => prev.filter((machine) => machine.id !== machineId));
    if (machineForm.id === machineId) clearMachineForm();

    if (isHealthDbConfigured) {
      try {
        await deleteVendingMachine(machineId);
        setMachineNotice('자판기 정보가 삭제되었습니다.');
      } catch {
        setMachineNotice('자판기 정보가 삭제되었습니다.');
      }
    } else {
      setMachineNotice('자판기 정보가 삭제되었습니다.');
    }
  };

  return (
    <main className="app-bg">
      <div className="phone-frame">
        {activeScreen === 'auth' && (
          <section className="auth-screen">
            <div className="auth-brand">
              <span className="pill-logo" />
              <h1>건강 정보 앱</h1>
              <p>키오스크 맞춤 추천을 위한 개인 건강 정보 관리</p>
            </div>

            <form className="auth-panel" onSubmit={handleAuthSubmit}>
              <div className="auth-tabs">
                <button
                  type="button"
                  className={authMode === 'login' ? 'active' : ''}
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError('');
                  }}
                >
                  로그인
                </button>
                <button
                  type="button"
                  className={authMode === 'signup' ? 'active' : ''}
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError('');
                  }}
                >
                  회원가입
                </button>
              </div>

              {authMode === 'signup' && (
                <label className="auth-field">
                  이름
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="이름"
                  />
                </label>
              )}
              <label className="auth-field">
                아이디
                <input
                  value={authForm.userId}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, userId: event.target.value }))}
                  placeholder="아이디"
                />
              </label>
              <label className="auth-field">
                비밀번호
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="비밀번호"
                />
              </label>

              {authError && <p className="form-error">{authError}</p>}
              <button className="auth-submit" type="submit">
                {authMode === 'login' ? '로그인' : '회원가입'}
              </button>
            </form>
          </section>
        )}

        {activeScreen === 'home' && (
          <>
            <header className="top-bar home-top">
              <span className="home-name">
                {profile.name} 님
              </span>
            </header>

            <section className="card-list">
              <button className="home-card" type="button" onClick={() => setScreen('map')}>
                <div>
                  <strong>지도</strong>
                  <p>자판기 위치 확인</p>
                </div>
                <span className="home-emoji" aria-hidden="true">🗺️</span>
              </button>

              <button className="home-card" type="button" onClick={openQr}>
                <div>
                  <strong>스캔</strong>
                  <p>개인 건강 정보 QR만들기</p>
                </div>
                <span className="home-emoji" aria-hidden="true">🔳</span>
              </button>

              <button className="home-card health-card" type="button" onClick={() => setScreen('health')}>
                <div>
                  <strong>건강 정보</strong>
                  <p>연령, 체중, 성별, 기저질환, 알러지 ...</p>
                </div>
                <span className="home-emoji" aria-hidden="true">❤️</span>
              </button>
            </section>
          </>
        )}

        {activeScreen === 'map' && (
          <>
            <Header title="자판기 위치" eyebrow="지도" onBack={() => setScreen('home')} />
            <section className="map-panel">
              <div id="kakao-map" className={`kakao-map ${!KAKAO_MAP_KEY ? 'map-fallback' : ''}`}>
                {!KAKAO_MAP_KEY && (
                  <div className="map-key-message">
                    <strong>카카오맵 API 키 필요</strong>
                    <span>설정 후 실제 지도와 마커가 표시됩니다.</span>
                  </div>
                )}
              </div>
              {mapStatus && <p className="db-notice">{mapStatus}</p>}
            </section>
          </>
        )}

        {activeScreen === 'admin' && (
          <>
            <Header title="자판기 관리" eyebrow="관리자" onBack={logout} />
            <section className="admin-panel">
              <div className="admin-summary">
                <strong>등록 자판기 {vendingMachines.length}대</strong>
                <button type="button" onClick={logout}>로그아웃</button>
              </div>
              <div className="admin-form">
                <input
                  value={machineForm.name}
                  onChange={(event) => setMachineForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="자판기 이름"
                />
                <input
                  value={machineForm.address}
                  onChange={(event) => setMachineForm((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="지도에서 위치를 선택하세요"
                />
                <div className="admin-map-picker-wrap">
                  <div id="admin-location-map" className="admin-location-map" />
                  <small>
                    {machineForm.lat && machineForm.lng
                      ? `선택 좌표 ${machineForm.lat}, ${machineForm.lng}`
                      : '지도에서 자판기 위치를 눌러주세요'}
                  </small>
                </div>
                <select
                  value={machineForm.status}
                  onChange={(event) => setMachineForm((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="운영중">운영중</option>
                  <option value="점검중">점검중</option>
                  <option value="중지">중지</option>
                </select>
                <div className="admin-actions">
                  <button type="button" onClick={submitMachine}>
                    {machineForm.id ? '수정' : '등록'}
                  </button>
                  <button type="button" onClick={clearMachineForm}>
                    초기화
                  </button>
                </div>
                {machineError && <p className="form-error">{machineError}</p>}
                {machineNotice && <p className="db-notice">{machineNotice}</p>}
              </div>

              <div className="machine-admin-list">
                {vendingMachines.map((machine) => (
                  <article key={machine.id} className="machine-admin-card">
                    <div>
                      <strong>{machine.name}</strong>
                      <span>{machine.address}</span>
                      <small>{machine.status} / {machine.lat}, {machine.lng}</small>
                    </div>
                    <div className="machine-card-actions">
                      <button type="button" onClick={() => editMachine(machine)}>수정</button>
                      <button type="button" onClick={() => removeMachine(machine.id)}>삭제</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {activeScreen === 'health' && (
          <>
            <Header
              title="신체 정보 입력"
              eyebrow={needsHealthSetup ? '필수 입력' : '건강 데이터'}
              onBack={() => setScreen(needsHealthSetup ? 'auth' : 'home')}
              backDisabled={needsHealthSetup}
            />

            <section className="form-panel">
              <Field label="이름" value={profile.name} onChange={(value) => updateProfile('name', value)} />
              <NumericField label="나이" value={profile.age} onChange={(value) => updateProfile('age', value)} />
              <div className="field-row">
                <label>키/체중</label>
                <div className="split-fields">
                  <input
                    value={profile.height}
                    onChange={(event) => updateProfile('height', toNumberText(event.target.value))}
                    inputMode="numeric"
                    aria-label="키"
                  />
                  <input
                    value={profile.weight}
                    onChange={(event) => updateProfile('weight', toNumberText(event.target.value))}
                    inputMode="numeric"
                    aria-label="체중"
                  />
                </div>
              </div>
              <SelectField
                label="성별"
                value={profile.gender}
                options={['남성', '여성']}
                onChange={(value) => updateProfile('gender', value)}
              />
              <SelectField
                label="흡연"
                value={profile.smoking}
                options={['비흡연', '흡연 중']}
                onChange={(value) => updateProfile('smoking', value)}
              />
              <SelectField
                label="음주량"
                value={profile.alcohol}
                options={['안 함', '월 1~2회', '주 1~2회', '주 3회 이상']}
                onChange={(value) => updateProfile('alcohol', value)}
              />

              <LinkedRow label="기저질환" value={conditionText} onClick={() => setScreen('disease')} />
              <LinkedRow label="알러지" value={profile.allergies || '직접 입력'} onClick={() => setScreen('allergy')} />
              <LinkedRow label="복용약물" value={profile.medications || '직접 입력'} onClick={() => setScreen('medication')} />

              <button className="primary-btn" type="button" onClick={saveHealthInfo} disabled={isSaving}>
                {isSaving ? '저장 중...' : '저장하기'}
              </button>
              {healthError && <p className="form-error">{healthError}</p>}
              {savedNotice && <p className="save-notice">{savedNotice}</p>}
            </section>
          </>
        )}

        {activeScreen === 'disease' && (
          <>
            <Header title="해당하는 질환" eyebrow="건강 데이터" onBack={() => setScreen('health')} />

            <section className="disease-wrap">
              {DISEASES.map((item) => (
                <button
                  key={item}
                  className={`tag-btn ${profile.conditions.includes(item) ? 'active' : ''}`}
                  type="button"
                  onClick={() => toggleDisease(item)}
                >
                  {item}
                </button>
              ))}
            </section>

            <button
              className="clear-btn"
              type="button"
              onClick={() => updateProfile('conditions', ['해당 없음'])}
            >
              해당 없음
            </button>
          </>
        )}

        {(activeScreen === 'allergy' || activeScreen === 'medication') && (
          <ChoiceOptionScreen
            config={CHOICE_SCREEN_CONFIG[activeScreen]}
            mode={activeScreen === 'allergy' ? allergyMode : medicationMode}
            value={profile[CHOICE_SCREEN_CONFIG[activeScreen].field]}
            onBack={() => setScreen('health')}
            onSelect={(value) => updateChoiceOption(activeScreen, value)}
            onCustomChange={(value) => updateProfile(CHOICE_SCREEN_CONFIG[activeScreen].field, value)}
            onDone={() => setScreen('health')}
          />
        )}

        {activeScreen === 'qr' && (
          <>
            <Header title="QR코드" eyebrow="키오스크 연동" onBack={() => setScreen('home')} />
            <section className="qr-screen-panel">
              <h2>{profile.name}</h2>
              <button
                className="qr-refresh"
                type="button"
                onClick={() => {
                  setQrImage(''); setQrError(''); setQrRefresh((value) => value + 1);
                }}
                aria-label="QR 새로고침"
              >
                <span aria-hidden="true">↻</span>
              </button>
              <p>시간 제한 없이 재사용할 수 있습니다. 건강정보를 수정하면 QR에 반영됩니다.</p>
              <div className="qr-image-wrap">
                {qrError ? <p role="alert">{qrError}</p>
                  : qrImage ? <img className="qr-image" src={qrImage} alt="키오스크 전달용 건강정보 QR코드" /> : <p>QR 생성 중...</p>}
              </div>
            </section>
          </>
        )}

        {activeScreen === 'history' && (
          <>
            <Header title="내 구매 내역" eyebrow="구매 기록" onBack={() => setScreen('home')} />
            <section className="history-panel">
              <button className="primary-btn" type="button" disabled={historyLoading} onClick={() => {
                setPurchaseHistory([]); setHistoryError(''); setHistoryLoading(true); setHistoryRefresh((value) => value + 1);
              }}>새로고침</button>
              {historyLoading ? <p role="status">구매 기록을 불러오는 중...</p>
                : historyError ? <p className="form-error" role="alert">{historyError}</p>
                  : purchaseHistory.length === 0 ? <p>완료된 구매 내역이 없습니다.</p>
                    : purchaseHistory.map((order) => (
                      <article className="history-order" key={order.id}>
                        <time>{new Date(order.completed_at || order.created_at).toLocaleString('ko-KR')}</time>
                        {(order.order_items || []).map((item) => <p key={item.id}>{item.product_name} × {item.quantity} 파우치 · {item.line_total.toLocaleString()}원</p>)}
                        <strong>총 {order.total_amount.toLocaleString()}원 · {order.is_simulated ? '시연 완료' : '구매 완료'}</strong>
                      </article>
                    ))}
            </section>
          </>
        )}

        {activeScreen === 'profile' && (
          <>
            <Header title="마이페이지" eyebrow="내 정보" onBack={() => setScreen('home')} />
            <section className="profile-panel">
              <div className="profile-avatar" aria-hidden="true" />
              <h2>{profile.name}</h2>
              <p>{profile.gender} / {profile.age}세</p>
              <dl>
                <div><dt>키/체중</dt><dd>{profile.height}cm / {profile.weight}kg</dd></div>
                <div><dt>흡연</dt><dd>{profile.smoking}</dd></div>
                <div><dt>음주량</dt><dd>{profile.alcohol}</dd></div>
                <div><dt>기저질환</dt><dd>{conditionText}</dd></div>
                <div><dt>알러지</dt><dd>{profile.allergies}</dd></div>
                <div><dt>복용약물</dt><dd>{profile.medications}</dd></div>
              </dl>
              <button className="logout-btn" type="button" onClick={logout}>
                로그아웃
              </button>
            </section>
          </>
        )}

        {activeScreen !== 'auth' && !session?.isAdmin && !needsHealthSetup && (
        <footer className="bottom-nav">
          <button type="button" onClick={openHistory} aria-label="구매내역">
            <svg className="nav-history" viewBox="0 0 40 44" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3h24v38l-6-4-6 4-6-4-6 4V3Z" />
              <path d="M14 13h12M14 21h12M14 29h8" />
            </svg>
            <small>구매내역</small>
          </button>
          <button type="button" onClick={() => setScreen('home')} aria-label="홈">
            <span className="nav-home" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setScreen('profile')} aria-label="마이페이지">
            <span className="nav-user" />
            <small>마이페이지</small>
          </button>
        </footer>
        )}
      </div>
    </main>
  );
}

function Header({ eyebrow, title, onBack, backDisabled = false }) {
  return (
    <header className="top-bar secondary">
      <div>
        <span className="section-label">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      <button className="back-button" type="button" onClick={onBack} aria-label="뒤로가기" disabled={backDisabled}>
        <span aria-hidden="true">←</span>
      </button>
    </header>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div className="field-row">
      <label>{label}</label>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumericField({ label, value, onChange }) {
  return (
    <div className="field-row">
      <label>{label}</label>
      <input value={value} inputMode="numeric" onChange={(event) => onChange(toNumberText(event.target.value))} />
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div className="field-row">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="" disabled>선택해주세요</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function LinkedRow({ label, value, onClick }) {
  return (
    <div className="field-row linked-row">
      <label>{label}</label>
      <button type="button" onClick={onClick}>
        <span>{value}</span>
        <small>수정</small>
      </button>
    </div>
  );
}

function ChoiceOptionScreen({ config, mode, value, onBack, onSelect, onCustomChange, onDone }) {
  const selected = String(value || '').split(',').map((item) => item.trim());
  const custom = selected.filter((item) => item && !config.options.includes(item)).join(', ');
  return (
    <>
      <Header title={config.title} eyebrow={config.eyebrow} onBack={onBack} />
      <section className="choice-option-wrap">
        <p>해당하는 항목을 모두 선택해주세요. 약은 가능하면 구체적인 성분·종류를 선택해주세요.</p>
        {config.options.map((option) => (
          <button
            key={option}
            className={`tag-btn ${(option === '직접 입력' ? mode === option || custom : selected.includes(option)) ? 'active' : ''}`}
            aria-pressed={option === '직접 입력' ? mode === option : selected.includes(option)}
            type="button"
            onClick={() => onSelect(option)}
          >
            {option}
          </button>
        ))}

      {(mode === '직접 입력' || custom) && (
          <input
            className="choice-detail choice-detail-full"
            value={value === '해당 없음' ? '' : value}
            onChange={(event) => onCustomChange(event.target.value)}
            placeholder={`${config.label} 전체 항목을 쉼표로 구분해주세요`}
          />
      )}

        <button className="primary-btn choice-done-btn" type="button" onClick={onDone}>
          완료
        </button>
      </section>
    </>
  );
}

export default App;
