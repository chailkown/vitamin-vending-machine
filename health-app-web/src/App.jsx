import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { createVersion6QrMatrix } from './qrVersion6';
import {
  createAppUser,
  deleteVendingMachine,
  findAppAdmin,
  findAppUser,
  getHealthProfile,
  getVendingMachines,
  isHealthDbConfigured,
  mapDbMachineToAppMachine,
  mapDbProfileToAppProfile,
  saveHealthProfile,
  saveVendingMachine,
} from './services/healthDb';

const STORAGE_KEY = 'health-app-profile-v1';
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

const DISEASES = ['간질환', '당뇨', '빈혈', '고혈압', '지방간', '고중성지방혈증', '위장질환'];
const REQUIRED_FIELDS = ['name', 'age', 'height', 'weight', 'gender', 'smoking', 'alcohol', 'allergies', 'medications'];
const ALLERGY_OPTIONS = ['해당 없음', '견과류', '유제품', '갑각류', '복숭아', '꽃가루', '직접 입력'];
const MEDICATION_OPTIONS = ['해당 없음', '혈압약', '당뇨약', '항응고제', '위장약', '진통제', '직접 입력'];
const CONDITION_CODES = {
  '해당 없음': 0,
  간질환: 1,
  당뇨: 2,
  빈혈: 3,
  고혈압: 4,
  지방간: 5,
  고중성지방혈증: 6,
  위장질환: 7,
};
const ALLERGY_CODES = {
  '해당 없음': 0,
  견과류: 1,
  유제품: 2,
  갑각류: 3,
  복숭아: 4,
  꽃가루: 5,
};
const MEDICATION_CODES = {
  '해당 없음': 0,
  혈압약: 1,
  당뇨약: 2,
  항응고제: 3,
  위장약: 4,
  진통제: 5,
};

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
const toList = (value) => {
  if (Array.isArray(value)) return value.length ? value : ['해당 없음'];
  return String(value || '해당 없음')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toFirstCode = (value, codeMap) => {
  const first = toList(value)[0] || '해당 없음';
  return codeMap[first] ?? 99;
};

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

const toKioskProfile = (profile, userId) => ({
  id: userId || 'local',
  n: profile.name,
  a: Number(profile.age),
  g: profile.gender === '남성' ? 'M' : 'F',
  h: Number(profile.height),
  w: Number(profile.weight),
  s: profile.smoking === '흡연 중' ? 1 : 0,
  al: {
    '안 함': 0,
    '월 1~2회': 1,
    '주 1~2회': 2,
    '주 3회 이상': 3,
  }[profile.alcohol] ?? 2,
  c: toFirstCode(profile.conditions, CONDITION_CODES),
  ag: toFirstCode(profile.allergies, ALLERGY_CODES),
  m: toFirstCode(profile.medications, MEDICATION_CODES),
});

const validateHealthInfo = (profile) => {
  const missing = REQUIRED_FIELDS.some((key) => !String(profile[key] ?? '').trim());
  if (missing) return '건강정보를 모두 입력해야 이용할 수 있습니다.';

  const age = Number(profile.age);
  const height = Number(profile.height);
  const weight = Number(profile.weight);

  if (!Number.isInteger(age) || age < 1 || age > 120) return '나이는 1~120 사이 숫자로 입력해주세요.';
  if (!Number.isInteger(height) || height < 80 || height > 230) return '키는 80~230cm 사이 숫자로 입력해주세요.';
  if (!Number.isInteger(weight) || weight < 20 || weight > 200) return '체중은 20~200kg 사이 숫자로 입력해주세요.';
  return '';
};

function App() {
  const [users, setUsers] = useState(() => loadJson(USERS_KEY, []));
  const [session, setSession] = useState(() => loadJson(SESSION_KEY, null));
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', userId: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [screen, setScreen] = useState(() => {
    const currentSession = loadJson(SESSION_KEY, null);
    if (!currentSession) return 'auth';
    return currentSession.isAdmin ? 'admin' : 'home';
  });
  const [profile, setProfile] = useState(() => {
    const savedProfile = loadJson(STORAGE_KEY, null);
    return savedProfile ? { ...DEFAULT_PROFILE, ...savedProfile } : DEFAULT_PROFILE;
  });
  const [savedNotice, setSavedNotice] = useState('');
  const [healthError, setHealthError] = useState('');
  const [qrCountdown, setQrCountdown] = useState(30);
  const [mapStatus, setMapStatus] = useState('');
  const [vendingMachines, setVendingMachines] = useState(() => loadJson(VENDING_MACHINES_KEY, DEFAULT_VENDING_MACHINES));
  const [machineForm, setMachineForm] = useState(EMPTY_MACHINE_FORM);
  const [machineNotice, setMachineNotice] = useState('');
  const [machineError, setMachineError] = useState('');
  const [allergyMode, setAllergyMode] = useState(() =>
    ALLERGY_OPTIONS.includes(loadJson(STORAGE_KEY, DEFAULT_PROFILE).allergies) ? loadJson(STORAGE_KEY, DEFAULT_PROFILE).allergies : '직접 입력'
  );
  const [medicationMode, setMedicationMode] = useState(() =>
    MEDICATION_OPTIONS.includes(loadJson(STORAGE_KEY, DEFAULT_PROFILE).medications) ? loadJson(STORAGE_KEY, DEFAULT_PROFILE).medications : '직접 입력'
  );
  const [needsHealthSetup, setNeedsHealthSetup] = useState(() => {
    const currentSession = loadJson(SESSION_KEY, null);
    return Boolean(currentSession?.needsHealthSetup);
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
    if (session?.userId) {
      localStorage.setItem(`${STORAGE_KEY}-${session.userId}`, JSON.stringify(profile));
    }
  }, [profile, session?.userId]);

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

  const activeScreen = session?.isAdmin
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

  const qrMatrix = useMemo(
    () => createVersion6QrMatrix(qrPayload),
    [qrPayload]
  );

  useEffect(() => {
    if (activeScreen !== 'qr') return undefined;
    const timer = setInterval(() => {
      setQrCountdown((prev) => {
        if (prev <= 1) {
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeScreen]);

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

  const getProfileKey = (userId) => `${STORAGE_KEY}-${userId}`;

  const startAdminSession = (user) => {
    setSession({ userId: user.userId, name: user.name, isAdmin: true });
    setNeedsHealthSetup(false);
    setMachineNotice('');
    setScreen('admin');
  };

  const startSession = async (user, forceHealthSetup = false) => {
    let userProfile = loadJson(getProfileKey(user.userId), null);
    let nextProfile = userProfile ? { ...DEFAULT_PROFILE, ...userProfile } : { ...DEFAULT_PROFILE, name: user.name };
    let needsSetup = forceHealthSetup || !userProfile;

    if (isHealthDbConfigured) {
      try {
        const dbProfile = await getHealthProfile(user.userId);
        if (dbProfile) {
          nextProfile = mapDbProfileToAppProfile(dbProfile, { ...DEFAULT_PROFILE, name: user.name });
          userProfile = nextProfile;
          needsSetup = false;
          localStorage.setItem(getProfileKey(user.userId), JSON.stringify(nextProfile));
        } else if (!forceHealthSetup) {
          needsSetup = true;
        }
      } catch {
        // DB 조회가 실패해도 로컬 저장값으로 계속 진행합니다.
      }
    }

    setProfile(nextProfile);
    setAllergyMode(ALLERGY_OPTIONS.includes(nextProfile.allergies) ? nextProfile.allergies : '직접 입력');
    setMedicationMode(MEDICATION_OPTIONS.includes(nextProfile.medications) ? nextProfile.medications : '직접 입력');
    setSession({ userId: user.userId, name: user.name, needsHealthSetup: needsSetup });
    setNeedsHealthSetup(needsSetup);
    setScreen(needsSetup ? 'health' : 'home');
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');

    const userId = authForm.userId.trim();
    const password = authForm.password.trim();
    const name = authForm.name.trim();

    if (!userId || !password || (authMode === 'signup' && !name)) {
      setAuthError('필수 항목을 입력해주세요.');
      return;
    }

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
          setUsers((prev) => (prev.some((user) => user.userId === found.userId) ? prev : [...prev, found]));
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
  };

  const logout = () => {
    setSession(null);
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
      const currentValue = profile[config.field];
      const isPreset = config.options.includes(currentValue);
      updateProfile(config.field, isPreset ? '' : currentValue);
      return;
    }

    updateProfile(config.field, value);
  };

  const saveHealthInfo = async () => {
    const validationMessage = validateHealthInfo(profile);
    if (validationMessage) {
      setHealthError(validationMessage);
      return;
    }
    setHealthError('');
    localStorage.setItem(getProfileKey(session.userId), JSON.stringify(profile));
    localStorage.setItem(`${KIOSK_PROFILE_KEY}-${session.userId}`, JSON.stringify(toKioskProfile(profile, session.userId)));
    if (isHealthDbConfigured) {
      try {
        await saveHealthProfile({
          userId: session.userId,
          profile,
          kioskPayload: toKioskProfile(profile, session.userId),
        });
      } catch {
        // DB 저장이 실패해도 로컬 저장은 완료된 상태입니다.
      }
    }
    const nextSession = { ...session, name: profile.name, needsHealthSetup: false };
    setSession(nextSession);
    setNeedsHealthSetup(false);
    setSavedNotice('저장되었습니다');
    setTimeout(() => {
      setSavedNotice('');
      setScreen('home');
    }, 800);
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
              <button className="name-button" type="button" onClick={() => setScreen('profile')}>
                {profile.name} 님
              </button>
              <button className="logout-top-btn" type="button" onClick={logout}>
                로그아웃
              </button>
            </header>

            <section className="card-list">
              <button className="home-card" type="button" onClick={() => setScreen('map')}>
                <div>
                  <strong>지도</strong>
                  <p>자판기 위치 확인</p>
                </div>
                <span className="home-emoji" aria-hidden="true">🗺️</span>
              </button>

              <button className="home-card" type="button" onClick={() => {
                setQrCountdown(30);
                setScreen('qr');
              }}>
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

              <button className="primary-btn" type="button" onClick={saveHealthInfo}>
                저장하기
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
                  setQrCountdown(30);
                }}
                aria-label="QR 새로고침"
              >
                <span aria-hidden="true">↻</span>
              </button>
              <p>{qrCountdown}초 남았습니다</p>
              <div className="qr-image-wrap">
                <QrCodeMatrix matrix={qrMatrix} />
              </div>
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
              <section className="kiosk-data-preview">
                <strong>키오스크 추천 데이터</strong>
                <code>{JSON.stringify(kioskProfile, null, 2)}</code>
              </section>
              <button className="primary-btn" type="button" onClick={() => setScreen('health')}>
                건강 정보 수정
              </button>
              <button className="logout-btn" type="button" onClick={logout}>
                로그아웃
              </button>
            </section>
          </>
        )}

        {activeScreen !== 'auth' && !session?.isAdmin && (
        <footer className="bottom-nav">
          <button type="button" onClick={() => setScreen('home')} aria-label="메뉴">
            <span className="nav-menu" />
            <small>메뉴</small>
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

function QrCodeMatrix({ matrix }) {
  return (
    <div
      className="qr-matrix"
      role="img"
      aria-label="키오스크 전달용 건강정보 QR코드"
      style={{ '--qr-size': matrix.length }}
    >
      {matrix.flatMap((row, rowIndex) =>
        row.map((dark, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className={dark ? 'dark' : undefined}
            aria-hidden="true"
          />
        ))
      )}
    </div>
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
  return (
    <>
      <Header title={config.title} eyebrow={config.eyebrow} onBack={onBack} />
      <section className="choice-option-wrap">
        {config.options.map((option) => (
          <button
            key={option}
            className={`tag-btn ${mode === option ? 'active' : ''}`}
            type="button"
            onClick={() => onSelect(option)}
          >
            {option}
          </button>
        ))}

      {mode === '직접 입력' && (
          <input
            className="choice-detail choice-detail-full"
            value={value}
            onChange={(event) => onCustomChange(event.target.value)}
            placeholder={`${config.label} 내용을 입력하세요`}
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
