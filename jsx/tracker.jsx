import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged,
  signOut
} from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  onSnapshot
} from "firebase/firestore";
import { 
  Menu, 
  X, 
  User, 
  LogOut, 
  Play, 
  Clock, 
  BarChart2, 
  ChevronRight, 
  Info,
  Dumbbell
} from 'lucide-react';

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = JSON.parse(localStorage.getItem('firebase_config') || '{}');
const safeConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : firebaseConfig;
// Fallback manuale se necessario, preso dal tuo file originale
const finalConfig = Object.keys(safeConfig).length > 0 ? safeConfig : {
    apiKey: "AIzaSyCfTXY1foD8Dr9UxRNzLeOu680aNtIw4TA",
    authDomain: "training-c0b76.firebaseapp.com",
    projectId: "training-c0b76",
    storageBucket: "training-c0b76.firebasestorage.app",
    messagingSenderId: "149618028951",
    appId: "1:149618028951:web:03756bdf1273a4521954d2"
};

const app = initializeApp(finalConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : finalConfig.projectId;

// --- DATI DEGLI ALLENAMENTI (Porting dal tuo file JS) ---
const INITIAL_WORKOUT_DAYS = {
	'day_1': {
		name: "Giorno 1: Petto e Tricipiti",
		exercises: [
			{ id: 'd1_e1', name: "Panca Piana - Bilanciere", sets: 4, reps: "12-10-10-8", rest: "90s", defaultWeight: 40, imageUrl: 'https://i.imgur.com/3Y8kE9A.gif', notes: "Mantieni le spalle basse e concentratevi solo sulla contrazione del petto." }, // Placeholder IMG
			{ id: 'd1_e2', name: "Panca 30° Multypower", sets: 3, reps: "10", rest: "90s", defaultWeight: 40, imageUrl: '', notes: "Movimento controllato, senti l'allungamento. Usa un peso moderato." },
			{ id: 'd1_e3', name: "Croci al Cavo alto", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 10, imageUrl: '', notes: "Porta il cavo fino in fondo. Contrai il tricipite alla massima estensione." },
			{ id: 'd1_e4', name: "Chest Press distensioni delle braccia", sets: 3, reps: "10", rest: "90s", defaultWeight: 25, imageUrl: '', notes: "Spingi i gomiti in avanti. Contrai il petto al massimo accorciamento." },
			{ id: 'd1_e5', name: "Pull Over - Manubrio", sets: 3, reps: "12", rest: "90s", defaultWeight: 20, imageUrl: '', notes: "" },
			{ id: 'd1_e6', name: "Spinte in Basso (Pushdown)", sets: 3, reps: "12", rest: "60s", defaultWeight: 15, imageUrl: '', notes: "Porta il cavo fino in fondo. Contrai il tricipite alla massima estensione." },
			{ id: 'd1_e7', name: "French Press (Manubri) panca 30°", sets: 3, reps: "12 (x braccio)", rest: "90s", defaultWeight: 12, imageUrl: '', notes: "Movimento controllato, senti l'allungamento. Usa un peso moderato." },
			{ id: 'd1_e8', name: "Lombari Iperestensioni", sets: 3, reps: "12", rest: "60s", defaultWeight: 40, imageUrl: '', notes: "Esegui lentamente con controllo. Non forzare l'estensione." },
			{ id: 'd1_e9', name: "Abdoninal Crunch", sets: 4, reps: "15", rest: "60s", defaultWeight: 20, imageUrl: '', notes: "Concentrati sull'avvicinare lo sterno al bacino, non sul collo." },
		]
	},
	'day_2': {
		name: "Giorno 2: Gambe e Spalle",
		exercises: [
			{ id: 'd2_e1', name: "Calf Raises on leg press", sets: 4, reps: "10", rest: "90s", defaultWeight: 40, imageUrl: '', notes: "Spingi con le punte." },
			{ id: 'd2_e2', name: "Leg Press", sets: 4, reps: "10", rest: "90s", defaultWeight: 70, imageUrl: '', notes: "Non bloccare le ginocchia in alto. Spingi con i talloni." },
			{ id: 'd2_e3', name: "Leg Extension", sets: 3, reps: "12", rest: "90s", defaultWeight: 25, imageUrl: '', notes: "Contrai il quadricipite per un secondo al massimo accorciamento." },
			{ id: 'd2_e4', name: "Leg Curl Sdraiato", sets: 3, reps: "12", rest: "90s", defaultWeight: 25, imageUrl: '', notes: "Focus sui femorali. Movimento lento in fase negativa." },
			{ id: 'd2_e5', name: "Lento avanti panca 70°", sets: 3, reps: "10 (x braccio)", rest: "90s", defaultWeight: 14, imageUrl: '', notes: "Siediti in modo da isolare solo gli adduttori. Controlla il ritorno." },
			{ id: 'd2_e6', name: "Alzate Laterali", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 12, imageUrl: '', notes: "Gomiti leggermente flessi. Porta i manubri all'altezza delle spalle, non più su." },
			{ id: 'd2_e7', name: "alzate posteriori su panca", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 10, imageUrl: '', notes: "Solleva alternando le braccia o entrambe insieme. Movimento controllato." },
			{ id: 'd2_e8', name: "Lombari Iperestensioni", sets: 3, reps: "12", rest: "60s", defaultWeight: 10, imageUrl: '', notes: "Esegui lentamente con controllo. Non forzare l'estensione." },
			{ id: 'd2_e9', name: "Abdoninal Crunch", sets: 4, reps: "15", rest: "60s", defaultWeight: 20, imageUrl: '', notes: "Concentrati sull'avvicinare lo sterno al bacino, non sul collo." },
		]
	},
	'day_3': {
		name: "Giorno 3: Schiena e Bicipiti",
		exercises: [
			{ id: 'd3_e1', name: "Rematore Manubri", sets: 4, reps: "8-10 (x braccio)", rest: "90s", defaultWeight: 18, imageUrl: '', notes: "Tira con i gomiti, non con i bicipiti. Schiena dritta." },
			{ id: 'd3_e2', name: "Lat Machine", sets: 4, reps: "8-10", rest: "90s", defaultWeight: 50, imageUrl: '', notes: "Tira con i gomiti, non con i bicipiti. Schiena dritta." },
			{ id: 'd3_e3', name: "Pulley basso con Triangolo", sets: 3, reps: "10-12", rest: "60s", defaultWeight: 30, imageUrl: '', notes: "Petto in fuori, schiena inarcata. Porta il triangolo all'ombelico." },
			{ id: 'd3_e4', name: "Row Machine", sets: 3, reps: "10-12", rest: "60s", defaultWeight: 50, imageUrl: '', notes: "Petto in fuori, schiena inarcata. Porta il triangolo all'ombelico." },
			{ id: 'd3_e5', name: "Curl seduto con Manubri", sets: 3, reps: "8-12 (x braccio)", rest: "90s", defaultWeight: 12, imageUrl: '', notes: "Ruota il polso (supinazione) durante la salita. Non oscillare." },
			{ id: 'd3_e6', name: "Hammer curl in piedi", sets: 3, reps: "10-12", rest: "60s", defaultWeight: 15, imageUrl: '', notes: "Focus sull'avambraccio. Presa neutra e stretta." },
			{ id: 'd3_e7', name: "Trazioni alla sbarra Chin Up", sets: 3, reps: "10", rest: "60s", defaultWeight: 40, imageUrl: '', notes: "Focus sull'avambraccio. Presa neutra e stretta." },
			{ id: 'd3_e8', name: "Lombari Iperestensioni", sets: 3, reps: "12", rest: "60s", defaultWeight: 10, imageUrl: '', notes: "Esegui lentamente con controllo. Non forzare l'estensione." },
			{ id: 'd3_e9', name: "Abdoninal Crunch", sets: 4, reps: "15", rest: "60s", defaultWeight: 20, imageUrl: '', notes: "Concentrati sull'avvicinare lo sterno al bacino, non sul collo." },
		]
	},
	'day_4': {
		name: "Giorno 4: Petto e Spalle",
		exercises: [
			{ id: 'd4_e1', name: "panca piana manubri", sets: 3, reps: "10-12 (x braccio)", rest: "90s", defaultWeight: 16, imageUrl: '', notes: "Non bloccare le ginocchia in alto. Spingi con i talloni." },
			{ id: 'd4_e2', name: "Chest Press distensioni delle braccia", sets: 3, reps: "8-12", rest: "90s", defaultWeight: 25, imageUrl: '', notes: "Spingi i gomiti in avanti. Contrai il petto al massimo accorciamento." },
			{ id: 'd4_e3', name: "panca inclinata manubri", sets: 3, reps: "10-12 (x braccio)", rest: "90s", defaultWeight: 16, imageUrl: '', notes: "Focus sui femorali. Movimento lento in fase negativa." },
			{ id: 'd4_e4', name: "Alzate Laterali", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 12, imageUrl: '', notes: "Gomiti leggermente flessi. Porta i manubri all'altezza delle spalle, non più su." },
			{ id: 'd4_e5', name: "Alzate Frontali", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 10, imageUrl: '', notes: "Solleva alternando le braccia o entrambe insieme. Movimento controllato." },
			{ id: 'd4_e6', name: "Alzate Posteriori su panca", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 10, imageUrl: '', notes: "Solleva alternando le braccia o entrambe insieme. Movimento controllato." },
			{ id: 'd4_e7', name: "Lombari Iperestensioni", sets: 3, reps: "12", rest: "60s", defaultWeight: 10, imageUrl: '', notes: "Esegui lentamente con controllo. Non forzare l'estensione." },
			{ id: 'd4_e8', name: "Abdoninal Crunch", sets: 4, reps: "15", rest: "60s", defaultWeight: 20, imageUrl: '', notes: "Concentrati sull'avvicinare lo sterno al bacino, non sul collo." },
		]
	},
};

// Placeholder per immagini mancanti (funzione helper)
const getImageUrl = (url, name) => {
    if (url) return url;
    return `https://placehold.co/400x200/2563eb/ffffff/png?text=${encodeURIComponent(name.toUpperCase())}`;
};

export default function App() {
  // --- STATO ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeDayId, setActiveDayId] = useState('day_1');
  const [workoutData, setWorkoutData] = useState(INITIAL_WORKOUT_DAYS);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [view, setView] = useState('dashboard'); // 'dashboard', 'guided', 'profile'
  
  // Stato Login Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // --- EFFETTI ---
  useEffect(() => {
    // Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
          // Qui potremmo caricare lo storico o i pesi salvati
          loadUserData(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
      // In futuro qui caricheremo i pesi salvati (logged_weights) da Firestore
      // Per ora manteniamo i dati statici o potremmo fare il merge se necessario
      console.log("Caricamento dati utente per:", userId);
  };

  // --- HANDLERS AUTH ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError('Errore login: Email o password errati.');
    }
  };

  const handleRegister = async () => {
      if (!confirm("Creare un nuovo account?")) return;
      try {
          await createUserWithEmailAndPassword(auth, email, password);
      } catch (err) {
          setAuthError(err.message);
      }
  };

  const handleLogout = async () => {
    if (confirm("Vuoi davvero uscire?")) {
        await signOut(auth);
        setIsMenuOpen(false);
    }
  };

  // --- COMPONENTI UI INTERNI ---

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // SCHERMATA LOGIN
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-sm bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
            <h2 className="text-3xl font-bold mb-2 text-center text-blue-400">Gym App</h2>
            <p className="text-gray-400 text-center mb-8 text-sm">Accedi per i tuoi allenamenti.</p>
            
            <form onSubmit={handleLogin}>
                <div className="mb-4">
                    <label className="block text-gray-400 text-xs font-bold mb-2 uppercase">Email</label>
                    <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none" 
                        placeholder="tua@email.com" 
                        required 
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-gray-400 text-xs font-bold mb-2 uppercase">Password</label>
                    <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full p-3 bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none" 
                        placeholder="••••••••" 
                        required 
                    />
                </div>
                
                {authError && <p className="text-red-500 text-xs mb-4 text-center">{authError}</p>}

                <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition mb-3">
                    Accedi
                </button>
                <button type="button" onClick={handleRegister} className="w-full py-3 bg-transparent border border-gray-500 text-gray-300 hover:text-white hover:border-white font-semibold rounded-lg transition">
                    Crea Account
                </button>
            </form>
        </div>
      </div>
    );
  }

  // SCHERMATA PRINCIPALE (Logged In)
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans pb-20 relative overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-20 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
            <h1 className="text-xl font-extrabold text-blue-500 tracking-tight flex items-center gap-2">
                <Dumbbell className="w-6 h-6" />
                Gym App
            </h1>
            <button 
                onClick={() => setIsMenuOpen(true)}
                className="p-2 rounded-full hover:bg-gray-700 text-gray-300 hover:text-white transition"
            >
                <Menu className="w-6 h-6" />
            </button>
        </div>
      </header>

      {/* MENU LATERALE (Off-Canvas) */}
      {isMenuOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
              <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setIsMenuOpen(false)}
              ></div>
              <div className="relative w-64 bg-gray-800 h-full shadow-2xl p-6 border-l border-gray-700 flex flex-col transform transition-transform animate-in slide-in-from-right">
                <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
                    <h3 className="text-xl font-bold text-blue-400">Menu</h3>
                    <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="space-y-2">
                    <button onClick={() => { setView('profile'); setIsMenuOpen(false); }} className="w-full flex items-center p-3 rounded-lg hover:bg-gray-700 transition text-left">
                        <User className="w-5 h-5 mr-3 text-pink-400" />
                        Profilo
                    </button>
                    <button onClick={() => { setView('history'); setIsMenuOpen(false); }} className="w-full flex items-center p-3 rounded-lg hover:bg-gray-700 transition text-left">
                        <BarChart2 className="w-5 h-5 mr-3 text-yellow-400" />
                        Storico
                    </button>
                </div>

                <button 
                    onClick={handleLogout}
                    className="mt-auto flex items-center p-3 rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20 transition"
                >
                    <LogOut className="w-5 h-5 mr-3" />
                    Esci
                </button>
              </div>
          </div>
      )}

      {/* CONTENUTO PRINCIPALE */}
      <main className="max-w-4xl mx-auto p-4">
        
        {/* VIEW: DASHBOARD (Lista Allenamenti) */}
        {view === 'dashboard' && (
            <>
                {/* Tabs Giorni */}
                <div className="flex overflow-x-auto no-scrollbar space-x-1 mb-6 bg-gray-800/50 p-1 rounded-xl">
                    {Object.keys(workoutData).map((dayId) => (
                        <button
                            key={dayId}
                            onClick={() => setActiveDayId(dayId)}
                            className={`flex-1 py-2 px-3 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                                activeDayId === dayId 
                                ? 'bg-blue-600 text-white shadow-lg' 
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            {workoutData[dayId].name.split(':')[0]} {/* Mostra solo "Giorno X" */}
                        </button>
                    ))}
                </div>

                {/* Titolo Giorno */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white">{workoutData[activeDayId].name}</h2>
                    <p className="text-gray-400 text-sm mt-1">{workoutData[activeDayId].exercises.length} Esercizi previsti</p>
                </div>

                {/* Bottone Avvia Allenamento (Placeholder) */}
                <div className="mb-8 text-center">
                    <button 
                        onClick={() => alert("La modalità guidata arriverà nel prossimo aggiornamento!")}
                        className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-full shadow-lg hover:shadow-red-500/30 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 mx-auto"
                    >
                        <Play className="w-5 h-5 fill-current" />
                        AVVIA ALLENAMENTO
                    </button>
                </div>

                {/* Lista Esercizi */}
                <div className="space-y-4">
                    {workoutData[activeDayId].exercises.map((exercise, index) => (
                        <div key={exercise.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-md">
                            <div className="flex flex-col sm:flex-row">
                                {/* Immagine */}
                                <div className="sm:w-1/3 h-48 sm:h-auto relative bg-gray-700">
                                    <img 
                                        src={getImageUrl(exercise.imageUrl, exercise.name)} 
                                        alt={exercise.name}
                                        className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white">
                                        #{index + 1}
                                    </div>
                                </div>

                                {/* Contenuto Card */}
                                <div className="p-5 flex-1 flex flex-col justify-center">
                                    <h3 className="text-lg font-bold text-white mb-2 leading-tight">{exercise.name}</h3>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div className="bg-gray-700/50 p-2 rounded-lg text-center">
                                            <span className="block text-xs text-gray-400 uppercase">Serie</span>
                                            <span className="text-blue-400 font-mono font-bold text-lg">{exercise.sets}</span>
                                        </div>
                                        <div className="bg-gray-700/50 p-2 rounded-lg text-center">
                                            <span className="block text-xs text-gray-400 uppercase">Reps</span>
                                            <span className="text-blue-400 font-mono font-bold text-lg">{exercise.reps}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                                        <Clock className="w-4 h-4 text-yellow-500" />
                                        Recupero: <span className="text-white font-medium">{exercise.rest}</span>
                                    </div>

                                    {exercise.notes && (
                                        <div className="mt-auto pt-3 border-t border-gray-700 flex items-start gap-2">
                                            <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                            <p className="text-xs text-gray-400 italic leading-relaxed">{exercise.notes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        )}

        {/* VIEW: PROFILO (Placeholder) */}
        {view === 'profile' && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
                <User className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Profilo Utente</h2>
                <p className="text-gray-400">Funzionalità in arrivo...</p>
                <button onClick={() => setView('dashboard')} className="mt-6 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white">Torna Indietro</button>
            </div>
        )}

      </main>
    </div>
  );
}
