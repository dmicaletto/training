import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, 
		setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, collection, getDocs, query, orderBy, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"; 
import { setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Variabili Globali
window.firebaseApp = null;
window.db = null;
window.auth = null;
window.userId = null;
window.activeDay = 'day_1'; // Giorno attivo di default
window.isPersistenceEnabled = false; // Flag per tracciare la persistenza

// Nuove variabili per la Modalità Guidata
window.isGuidedMode = false;
window.currentExIndex = 0; // Indice dell'esercizio corrente (0-based)
window.currentSet = 1;      // Numero della serie corrente (1-based)
window.unsubscribeListener = null; // Per pulire il listener Firestore

// Variabili per Cronometro Totale e Tonnellaggio
window.totalTimeSeconds = 0;
window.totalTimerInterval = null;
window.totalTonnage = 0; 
window.exerciseTonnageMap = {}; 
window.totalCalories = 0; // NUOVO: Calorie totali stimate
window.currentWorkoutRating = 0; // Per la valutazione (da 1 a 5)
window.chartTimeRange = 'week'; // Valore di default: 'week' o 'month'
window.floatingNotificationTimer = null;
// DATI DEL PROFILO UTENTE
window.userProfile = {
	name: 'Davide',
	surname: 'Micaletto',
	age: 52,
	weight: 67,
	sex: 'F' 
};

// --- NUOVE FUNZIONI DI LOGIN / LOGOUT ---
async function handleAuth() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('auth-error');
    const btn = document.getElementById('btn-login');
    
    errorMsg.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Accesso in corso...';

    try {
        await signInWithEmailAndPassword(window.auth, email, password);
        // Se ok, il listener onAuthStateChanged farà sparire il modale
    } catch (error) {
        console.error(error);
        errorMsg.textContent = "Errore: Email o password errati.";
        errorMsg.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = 'Accedi';
    }
}
window.handleAuth = handleAuth;

async function handleRegister() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('auth-error');
    
    if (!email || password.length < 6) {
        errorMsg.textContent = "Inserisci email e password (min 6 caratteri).";
        errorMsg.classList.remove('hidden');
        return;
    }

    if(!confirm("Creare un nuovo account con questa email?")) return;

    try {
        await createUserWithEmailAndPassword(window.auth, email, password);
    } catch (error) {
        let msg = "Errore registrazione.";
        if (error.code === 'auth/email-already-in-use') msg = "Email già registrata.";
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    }
}
window.handleRegister = handleRegister;

async function logout() {
    if(confirm("Vuoi uscire?")) {
        await signOut(window.auth);
        window.location.reload(); 
    }
}
window.logout = logout;

// Struttura degli allenamenti (DATI MOCK AGGIORNATI CON NOTE DI DEFAULT)
window.workoutDays = {
	'day_1': {
		name: "Giorno 1: Petto e Tricipiti",
		exercises: [
			{ name: "Panca Piana - Bilanciere", sets: 4, reps: "12-10-10-8", rest: "90s", defaultWeight: 20, imageUrl: './images/panca-piana.gif?text=PANCA+PIANA', notes: "Mantieni le spalle basse e concentratevi solo sulla contrazione del petto." },
			{ name: "Panca 30° Multypower", sets: 3, reps: "10", rest: "90s", defaultWeight: 6, imageUrl: './images/panca-multypower.gif?text=PANCA+INCLINATA+MULTYPOWER?text=FRENCH+PRESS', notes: "Movimento controllato, senti l'allungamento. Usa un peso moderato." },
			{ name: "Croci al Cavo alto", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 10, imageUrl: './images/Croci-ai-cavi-alti.gif?text=TRICIPITI+PUSH', notes: "Porta il cavo fino in fondo. Contrai il tricipite alla massima estensione." },
			{ name: "Chest Press distensioni delle braccia", sets: 3, reps: "10", rest: "90s", defaultWeight: 20, imageUrl: './images/Chest-Press-Machine.gif?text=CHEST+PRESS', notes: "Spingi i gomiti in avanti. Contrai il petto al massimo accorciamento." },
			{ name: "Pull Over - Manubrio", sets: 3, reps: "12", rest: "90s", defaultWeight: 20, imageUrl: './images/pullover.gif?text=PULLOVER+MANUBRIO', notes: "" },
			{ name: "Spinte in Basso (Pushdown)", sets: 3, reps: "12", rest: "60s", defaultWeight: 10, imageUrl: './images/pushdown.png?text=TRICIPITI+PUSH', notes: "Porta il cavo fino in fondo. Contrai il tricipite alla massima estensione." },
			{ name: "French Press (Manubri) panca 30°", sets: 3, reps: "12 (x braccio)", rest: "90s", defaultWeight: 6, imageUrl: './images/french-press.png?text=PECTORAL+FLY?text=FRENCH+PRESS', notes: "Movimento controllato, senti l'allungamento. Usa un peso moderato." },
			{ name: "Lombari Iperestensioni", sets: 3, reps: "15", rest: "60s", defaultWeight: 40, imageUrl: './images/hyperextension.gif?text=HYPEREXTENSION', notes: "Esegui lentamente con controllo. Non forzare l'estensione." },
			{ name: "Abdoninal Crunch", sets: 3, reps: "15", rest: "60s", defaultWeight: 40, imageUrl: './images/ABS_CRUNCH_MC.gif?text=CRUNCH', notes: "Concentrati sull'avvicinare lo sterno al bacino, non sul collo." },
		]
	},
	'day_2': {
		name: "Giorno 2: Gambe e Spalle",
		exercises: [
			{ name: "Leg Press", sets: 4, reps: "10", rest: "90s", defaultWeight: 70, imageUrl: './images/leg-press.png?text=LEG+PRESS', notes: "Non bloccare le ginocchia in alto. Spingi con i talloni." },
			{ name: "Leg Extension", sets: 3, reps: "12", rest: "90s", defaultWeight: 25, imageUrl: './images/legext.png?text=LEG+EXT', notes: "Contrai il quadricipite per un secondo al massimo accorciamento." },
			{ name: "Leg Curl Sdraiato", sets: 3, reps: "12", rest: "90s", defaultWeight: 25, imageUrl: './images/leg-curl-sdraiato-bg.png?text=LEG+CURL', notes: "Focus sui femorali. Movimento lento in fase negativa." },
			{ name: "Lento avanti panca 70°", sets: 3, reps: "10 (x braccio)", rest: "90s", defaultWeight: 15, imageUrl: './images/lento-manubri.gif?text=LENTO+MANUBRI', notes: "Siediti in modo da isolare solo gli adduttori. Controlla il ritorno." },
			{ name: "Alzate Laterali", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 8, imageUrl: './images/alzate-laterali.png?text=ALZATE+LATERALI', notes: "Gomiti leggermente flessi. Porta i manubri all'altezza delle spalle, non più su." },
			{ name: "alzate posteriori su panca", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 8, imageUrl: './images/inverso-manubri-panca-alta-bg.png?text=ALZATE+POSTERIORI', notes: "Solleva alternando le braccia o entrambe insieme. Movimento controllato." },
			{ name: "Lombari Iperestensioni", sets: 3, reps: "15", rest: "60s", defaultWeight: 40, imageUrl: './images/hyperextension.gif?text=HYPEREXTENSION', notes: "Esegui lentamente con controllo. Non forzare l'estensione." },
			{ name: "Abdoninal Crunch", sets: 3, reps: "15", rest: "60s", defaultWeight: 40, imageUrl: './images/ABS_CRUNCH_MC.gif?text=CRUNCH', notes: "Concentrati sull'avvicinare lo sterno al bacino, non sul collo." },
		]
	},
	'day_3': {
		name: "Giorno 3: Schiena e Bicipiti",
		exercises: [
			{ name: "Rematore Manubri", sets: 4, reps: "8-10 (x braccio)", rest: "90s", defaultWeight: 50, imageUrl: './images/rematore-manubrio.gif?text=REMATORE+MANUBRIO', notes: "Tira con i gomiti, non con i bicipiti. Schiena dritta." },
			{ name: "Lat Machine", sets: 4, reps: "8-10", rest: "90s", defaultWeight: 50, imageUrl: './images/lat-machine.png?text=LAT+MACHINE', notes: "Tira con i gomiti, non con i bicipiti. Schiena dritta." },
			{ name: "Pulley basso con Triangolo", sets: 3, reps: "10-12", rest: "60s", defaultWeight: 20, imageUrl: './images/pulley-basso.png?text=REMATORE', notes: "Petto in fuori, schiena inarcata. Porta il triangolo all'ombelico." },
			{ name: "Row Machine", sets: 3, reps: "10-12", rest: "60s", defaultWeight: 20, imageUrl: './images/Row-Machine.gif?text=ROW+MACHINE', notes: "Petto in fuori, schiena inarcata. Porta il triangolo all'ombelico." },
			{ name: "Curl seduto con Manubri", sets: 3, reps: "8-12 (x braccio)", rest: "90s", defaultWeight: 25, imageUrl: './images/curl-manubri-seduto-bg.png?text=CURL+BILANCIERE', notes: "Ruota il polso (supinazione) durante la salita. Non oscillare." },
			{ name: "Hammer curl in piedi", sets: 3, reps: "10-12", rest: "60s", defaultWeight: 10, imageUrl: './images/hammer-curl.png?text=CURL+HAMMER', notes: "Focus sull'avambraccio. Presa neutra e stretta." },
			{ name: "Lombari Iperestensioni", sets: 3, reps: "15", rest: "60s", defaultWeight: 40, imageUrl: './images/hyperextension.gif?text=HYPEREXTENSION', notes: "Esegui lentamente con controllo. Non forzare l'estensione." },
			{ name: "Abdoninal Crunch", sets: 3, reps: "15", rest: "60s", defaultWeight: 40, imageUrl: './images/ABS_CRUNCH_MC.gif?text=CRUNCH', notes: "Concentrati sull'avvicinare lo sterno al bacino, non sul collo." },
		]
	},
	'day_4': {
		name: "Giorno 4: Petto e Spalle",
		exercises: [
			{ name: "panca piana manubri", sets: 3, reps: "10-12 (x braccio)", rest: "90s", defaultWeight: 120, imageUrl: './images/Chest-Press-con-Manubri-gif.gif?text=CHEST+MANUBRI', notes: "Non bloccare le ginocchia in alto. Spingi con i talloni." },
			{ name: "Chest Press distensioni delle braccia", sets: 3, reps: "8-12", rest: "90s", defaultWeight: 20, imageUrl: './images/chestpress.png?text=CHEST+PRESS', notes: "Spingi i gomiti in avanti. Contrai il petto al massimo accorciamento." },
			{ name: "panca inclinata manubri", sets: 3, reps: "10-12 (x braccio)", rest: "90s", defaultWeight: 120, imageUrl: './images/spinte-panca-alta-manubri.png?text=SPINTE+PANCA+ALTA', notes: "Focus sui femorali. Movimento lento in fase negativa." },
			{ name: "Alzate Laterali", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 8, imageUrl: './images/alzate-laterali.png?text=ALZATE+LATERALI', notes: "Gomiti leggermente flessi. Porta i manubri all'altezza delle spalle, non più su." },
			{ name: "Alzate Frontali", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 8, imageUrl: './images/alzate-frontali.png?text=ALZATE+FRONTALI', notes: "Solleva alternando le braccia o entrambe insieme. Movimento controllato." },
			{ name: "Alzate Posteriori su panca", sets: 3, reps: "10 (x braccio)", rest: "60s", defaultWeight: 8, imageUrl: './images/inverso-manubri-panca-alta-bg.png?text=ALZATE+POSTERIORI', notes: "Solleva alternando le braccia o entrambe insieme. Movimento controllato." },
			{ name: "Lombari Iperestensioni", sets: 3, reps: "15", rest: "60s", defaultWeight: 40, imageUrl: './images/hyperextension.gif?text=HYPEREXTENSION', notes: "Esegui lentamente con controllo. Non forzare l'estensione." },
			{ name: "Abdoninal Crunch", sets: 3, reps: "15", rest: "60s", defaultWeight: 40, imageUrl: './images/ABS_CRUNCH_MC.gif?text=CRUNCH', notes: "Concentrati sull'avvicinare lo sterno al bacino, non sul collo." },
		]
	},
};
// NUOVE FUNZIONI: Controllo Menu Laterale (Off-Canvas)
function openMenu() {
	document.getElementById('off-canvas-menu').classList.remove('hidden');
	// Forziamo il reflow e poi attiviamo la transizione
	setTimeout(() => {
		document.getElementById('off-canvas-menu').classList.add('active');
	}, 10); 
}
window.openMenu = openMenu;

function closeMenu() {
	document.getElementById('off-canvas-menu').classList.remove('active');
	// Aspetta che l'animazione finisca (0.3s) prima di nascondere completamente
	setTimeout(() => {
		document.getElementById('off-canvas-menu').classList.add('hidden');
	}, 300); 
}
window.closeMenu = closeMenu;

function openProfileModal() {
	closeMenu(); // Chiude il menu laterale
	const modal = document.getElementById('profile-modal');
	modal.classList.remove('hidden');
	renderProfileContent();
}
window.openProfileModal = openProfileModal;

function openHistoryModal() {
	closeMenu(); // Chiude il menu laterale
	const modal = document.getElementById('history-modal');
	modal.classList.remove('hidden');
	loadAndRenderHistory(); // Avvia il caricamento dei dati
}
window.openHistoryModal = openHistoryModal;

function closeProfileModal() {
	document.getElementById('profile-modal').classList.add('hidden');
}
window.closeProfileModal = closeProfileModal;

function closeHistoryModal() {
	document.getElementById('history-modal').classList.add('hidden');
}
window.closeHistoryModal = closeHistoryModal;

/**
 * Carica lo storico degli allenamenti da Firestore e lo renderizza.
 */
async function loadAndRenderHistory() {
    const historyColRef = getHistoryCollectionRef();
    const historyContentDiv = document.getElementById('history-content');
    historyContentDiv.innerHTML = '<p class="text-center text-yellow-400">Caricamento storico in corso...</p>';
    
    if (!historyColRef) {
        historyContentDiv.innerHTML = '<p class="text-center text-red-500">Errore: Persistenza non attiva o utente non loggato.</p>';
        return;
    }

    try {
        const historyQuery = query(historyColRef, orderBy("date", "desc"), orderBy("endTime", "desc"));
        const querySnapshot = await getDocs(historyQuery); 
        
        const historyData = [];
        // Set per raccogliere i nomi unici degli allenamenti (es. Giorno 1, Giorno 2)
        const uniqueWorkoutNames = new Set();

        querySnapshot.forEach(doc => {
            const data = doc.data();
            historyData.push({ id: doc.id, ...data });
            if (data.dayName) uniqueWorkoutNames.add(data.dayName);
        });

        // --- NUOVO: Salviamo i dati in cache per il grafico di progressione ---
        window.cachedHistoryData = historyData;

        // --- Preparazione Dati Grafico Generale (Settimana/Mese) ---
        const chartDataArray = [];
        const today = new Date();

        if (window.chartTimeRange === 'week') {
            const dayLabels = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                chartDataArray.push({
                    dateString: d.toISOString().split('T')[0],
                    dayLabel: dayLabels[d.getDay()],
                    totalTonnage: 0,
                    totalCalories: 0,
                    hasWorkout: false
                });
            }
        } else {
            for (let i = 29; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(today.getDate() - i);
                chartDataArray.push({
                    dateString: d.toISOString().split('T')[0],
                    dayLabel: d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }), 
                    totalTonnage: 0,
                    totalCalories: 0,
                    hasWorkout: false
                });
            }
        }

        // --- Popolamento Dati Grafico Generale e Lista ---
        let listHtml = '<div class="mt-8 pt-4 border-t border-gray-600"><h4 class="text-xl font-bold text-white mb-4">Lista Allenamenti Recenti</h4><div class="space-y-4">';
        let hasRecentHistory = false;

        historyData.forEach(log => {
            hasRecentHistory = true;
            const totalTonnage = log.totalTonnage || 0;
            const estimatedCalories = log.estimatedCalories || 0;
            const durationDisplay = log.durationDisplay || 'N/A';
            const rating = log.rating || 0;

            const dayData = chartDataArray.find(d => d.dateString === log.date);
            if (dayData) {
                dayData.totalTonnage += totalTonnage;
                dayData.totalCalories += estimatedCalories;
                dayData.hasWorkout = true;
            }

            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                starsHtml += `<span class="text-xs ${i <= rating ? 'text-yellow-400' : 'text-gray-500'}">&#9733;</span>`;
            }

            listHtml += `
                <div class="bg-gray-700 p-4 rounded-lg border border-gray-600 shadow-md">
                    <div class="flex justify-between items-start border-b border-gray-500 pb-2 mb-2">
                        <h4 class="text-lg font-bold text-blue-300 leading-tight">${log.dayName}</h4>
                        <div class="text-right flex-shrink-0 ml-2">
                            <span class="text-xs text-gray-400 block">${log.date}</span>
                            <div class="mt-1">${starsHtml}</div>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-xs sm:text-sm">
                        <div><p class="text-gray-400">Volume</p><p class="font-bold text-white">${totalTonnage.toLocaleString('it-IT')} kg</p></div>
                        <div><p class="text-gray-400">Calorie</p><p class="font-bold text-red-400">${estimatedCalories} kcal</p></div>
                        <div><p class="text-gray-400">Durata</p><p class="font-bold text-white">${durationDisplay}</p></div>
                    </div>
                </div>
            `;
        });

        if (!hasRecentHistory) listHtml += '<p class="text-center text-gray-400 p-8">Nessun allenamento trovato.</p>';
        listHtml += '</div></div>';

        // --- Costruzione Grafico Generale ---
        const chartDataForJson = chartDataArray.map(d => ({
            day: d.dayLabel,
            totalTonnage: d.totalTonnage,
            totalCalories: d.totalCalories,
            hasWorkout: d.hasWorkout
        }));

        const weekBtnClass = window.chartTimeRange === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300';
        const monthBtnClass = window.chartTimeRange === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300';

        // --- NUOVO: Costruzione Sezione Progressione ---
        // Creiamo le option per il dropdown basandoci sui nomi unici trovati
        let progressionOptions = '';
        uniqueWorkoutNames.forEach(name => {
            progressionOptions += `<option value="${name}">${name}</option>`;
        });

        // Se non ci sono allenamenti, mettiamo un placeholder
        const progressionSectionHtml = uniqueWorkoutNames.size > 0 ? `
            <div class="mt-8 pt-4 border-t border-gray-600">
                <h4 class="text-xl font-bold text-white mb-4">Progressione Allenamento</h4>
                <div class="mb-4">
                    <label for="progression-select" class="block text-xs font-medium text-gray-400 mb-1 uppercase">Seleziona Scheda</label>
                    <select id="progression-select" onchange="window.renderProgressionChart(this.value)" class="w-full p-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500">
                        ${progressionOptions}
                    </select>
                </div>
                <div class="relative h-64 md:h-80 min-h-[250px] p-4 bg-gray-700 rounded-lg">
                    <canvas id="progressionChart"></canvas>
                </div>
            </div>
        ` : '';

        // --- Assemblaggio HTML Finale ---
        let chartHtml = `
            <div>
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-xl font-bold text-white">Statistiche ${window.chartTimeRange === 'week' ? '7gg' : '30gg'}</h4>
                    <div class="flex space-x-2">
                        <button onclick="window.setChartTimeRange('week')" class="px-3 py-1 text-xs font-medium rounded-full transition-colors ${weekBtnClass}">Sett.</button>
                        <button onclick="window.setChartTimeRange('month')" class="px-3 py-1 text-xs font-medium rounded-full transition-colors ${monthBtnClass}">Mese</button>
                    </div>
                </div>
                <div id="weekly-chart-container" class="relative h-64 md:h-80 min-h-[250px] p-4 bg-gray-700 rounded-lg">
                    <canvas id="weeklyChart"></canvas>
                </div>
                <textarea id="chart-data-dump" class="hidden">${JSON.stringify(chartDataForJson)}</textarea>
            </div>
        `;
        
        // Ordine: Grafico Generale -> Grafico Progressione -> Lista
        historyContentDiv.innerHTML = chartHtml + progressionSectionHtml + listHtml;
        
        // Render dei grafici
        if (chartDataForJson.some(d => d.hasWorkout)) {
            renderWeeklyChart();
        } else {
            document.getElementById('weekly-chart-container').innerHTML = '<p class="text-center text-gray-400 p-8 flex items-center justify-center h-full">Nessun dato recente.</p>';
        }

        // Render iniziale del grafico progressione (seleziona il primo allenamento della lista)
        if (uniqueWorkoutNames.size > 0) {
            const firstWorkout = uniqueWorkoutNames.values().next().value;
            renderProgressionChart(firstWorkout);
        }

    } catch (error) {
        console.error("Errore storico:", error);
        historyContentDiv.innerHTML = `<p class="text-center text-red-500 p-8">Errore: ${error.message}</p>`;
    }
}
window.loadAndRenderHistory = loadAndRenderHistory;

/**
 * Renderizza il contenuto dinamico della modale profilo.
 */
function renderProfileContent() {
	const container = document.getElementById('personal-info-content');
	if (!container) return;

	container.innerHTML = `
		<div class="grid grid-cols-1 gap-4">
			<div class="flex flex-col">
				<label for="profile-name" class="text-sm font-semibold mb-1 text-gray-400">Nome</label>
				<input type="text" id="profile-name" value="${window.userProfile.name}"
						onchange="window.saveUserProfile('name', this.value)"
						class="w-full p-2 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
						placeholder="Nome">
			</div>
			<div class="flex flex-col">
				<label for="profile-surname" class="text-sm font-semibold mb-1 text-gray-400">Cognome</label>
				<input type="text" id="profile-surname" value="${window.userProfile.surname}"
						onchange="window.saveUserProfile('surname', this.value)"
						class="w-full p-2 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
						placeholder="Cognome">
			</div>
		</div>
		<div class="grid grid-cols-3 gap-4 mt-4">
			<div class="flex flex-col">
				<label for="profile-sex" class="text-sm font-semibold mb-1 text-gray-400">Sesso</label>
				<select id="profile-sex" 
						onchange="window.saveUserProfile('sex', this.value)"
						class="w-full p-2 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150">
					<option value="F" ${window.userProfile.sex === 'F' ? 'selected' : ''}>F</option>
					<option value="M" ${window.userProfile.sex === 'M' ? 'selected' : ''}>M</option>
				</select>
			</div>
			<div class="flex flex-col">
				<label for="profile-age" class="text-sm font-semibold mb-1 text-gray-400">Età</label>
				<input type="number" step="1" id="profile-age" value="${window.userProfile.age}"
						onchange="window.saveUserProfile('age', this.value)"
						class="w-full p-2 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
						placeholder="00">
			</div>
			 <div class="flex flex-col">
				<label for="profile-weight" class="text-sm font-semibold mb-1 text-gray-400">Peso (kg)</label>
				<input type="number" step="0.1" id="profile-weight" value="${window.userProfile.weight}"
						onchange="window.saveUserProfile('weight', this.value)"
						class="w-full p-2 text-white bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150"
						placeholder="00.0">
			</div>
		</div>
		<p class="text-xs text-gray-500 mt-4 text-center">I dati vengono salvati automaticamente.</p>
	`;
}

/**
 * Imposta l'intervallo di tempo per il grafico (settimana/mese) e ricarica i dati.
 */
function setChartTimeRange(range) {
	if (window.chartTimeRange === range) return; // Non fare nulla se è già selezionato
	window.chartTimeRange = range;
	
	// Ricarica l'intero contenuto della modale per aggiornare grafico e bottoni
	loadAndRenderHistory();
}
window.setChartTimeRange = setChartTimeRange;

/**
 * NUOVA FUNZIONE: Inizializza l'IntersectionObserver per i pallini dello swiper.
 * Viene chiamata da renderDay dopo che l'HTML è stato creato.
 */
function initSwiperObserver() {
	const swiperContainer = document.querySelector('.horizontal-snap-container');
	// Seleziona le card
	const cards = document.querySelectorAll('.horizontal-snap-child');
	// Seleziona i pallini
	const dots = document.querySelectorAll('.swiper-dot');

	if (!swiperContainer || cards.length === 0 || dots.length === 0) {
		return; // Non fa nulla se non ci sono gli elementi
	}

	// Opzioni per l'observer:
	const options = {
		root: swiperContainer, // Osserva lo scroll all'interno del contenitore
		rootMargin: '0px',
		threshold: 0.51 // L'elemento deve essere visibile almeno al 51%
	};

	const observer = new IntersectionObserver((entries, observer) => {
		entries.forEach(entry => {
			// Se l'elemento è quello visibile (intersecante)
			if (entry.isIntersecting) {
				// Prendi l'indice (che aggiungeremo a breve)
				const index = parseInt(entry.target.dataset.index, 10);

				// Aggiorna i pallini
				dots.forEach((dot, dotIndex) => {
					if (dotIndex === index) {
						dot.classList.add('active');
					} else {
						dot.classList.remove('active');
					}
				});
			}
		});
	}, options);

	// "Attacca" l'observer a ogni card
	cards.forEach(card => {
		observer.observe(card);
	});
}
window.initSwiperObserver = initSwiperObserver;
/**
 * Imposta la valutazione (da 1 a 5) e aggiorna l'UI delle stelle.
 */
function setRating(rating) {
	window.currentWorkoutRating = rating;
	const stars = document.querySelectorAll('.rating-star');
	stars.forEach((star, index) => {
		if (index < rating) {
			// Stella piena (gialla)
			star.classList.remove('text-gray-600');
			star.classList.add('text-yellow-400');
			star.innerHTML = '&#9733;'; // Stella piena
		} else {
			// Stella vuota (grigia)
			star.classList.remove('text-yellow-400');
			star.classList.add('text-gray-600');
			star.innerHTML = '&#9734;'; // Stella vuota
		}
	});
}
window.setRating = setRating;
/**
 * NUOVA: Chiude la notifica floating.
 */
function closeFloatingNotification() {
	const container = document.getElementById('floating-notification-container');
	if (container) {
		// Nasconde la barra facendola scorrere verso l'alto
		container.classList.add('-translate-y-full');
	}
	// Pulisce il timer di chiusura automatica, se esiste
	if (window.floatingNotificationTimer) {
		clearTimeout(window.floatingNotificationTimer);
		window.floatingNotificationTimer = null;
	}
}
window.closeFloatingNotification = closeFloatingNotification;
// --- GESTIONE DATI UTENTE E FIRESTORE ---

function getLogDocumentRef(dayId) {
	if (!window.userId || !window.db || !window.isPersistenceEnabled) return null;
	// Percorso standard per dati privati in Canvas
	const appId = window.appId || 'default-app-id'; 
	const collectionPath = `artifacts/${appId}/users/${window.userId}/workout_logs`;
	return doc(window.db, collectionPath, dayId);
}

/**
 * Riferimento al documento del profilo utente (6 Segmenti).
 */
function getProfileDocumentRef() {
	if (!window.userId || !window.db || !window.isPersistenceEnabled) return null;
	const appId = window.appId || 'default-app-id'; 
	// Percorso a 6 segmenti: C/D/C/D/C/D
	return doc(window.db, 
			   `artifacts/${appId}/users/${window.userId}/profiles_meta`, 
			   'data' // Nome del documento
		   ); 
}
// NUOVA FUNZIONE: Riferimento alla collezione dello storico
function getHistoryCollectionRef() {
	if (!window.userId || !window.db || !window.isPersistenceEnabled) return null;
	const appId = window.appId || 'default-app-id'; 
	// Percorso: artifacts/{appId}/users/{userId}/workout_history
	return collection(window.db, `artifacts/${appId}/users/${window.userId}/workout_history`);
}
/**
 * Carica il profilo utente da Firestore o usa i default, poi aggiorna il titolo.
 */
async function loadUserProfile() {
	const docRef = getProfileDocumentRef();
	
	if (!docRef) { 
		renderUserProfileTitle();
		return; 
	}

	try {
		const docSnap = await getDoc(docRef);
		if (docSnap.exists()) {
			const profileData = docSnap.data();
			
			window.userProfile = {
				name: profileData.name || window.userProfile.name,
				surname: profileData.surname || window.userProfile.surname,
				weight: parseFloat(profileData.weight) || window.userProfile.weight,
				age: parseInt(profileData.age) || window.userProfile.age,
				sex: profileData.sex || window.userProfile.sex, 
			};
		} else {
			 console.log("Documento profilo non trovato. Vengono usati i valori di default.");
		}
	} catch (error) {
		console.error("Errore critico nel caricamento del profilo utente, ma il rendering prosegue:", error);
	} finally {
		renderUserProfileTitle();
	}
}

/**
 * Salva e aggiorna i dati del profilo utente.
 */
async function saveUserProfile(field, value) {
	if (!window.isPersistenceEnabled || !window.userId) {
		showTemporaryMessage('ATTENZIONE: Persistenza disabilitata. Dati NON salvati.', 'bg-red-500');
		return;
	}

	const docRef = getProfileDocumentRef();
	if (!docRef) return;
	
	// 1. Aggiorna la variabile globale (e gestisce il parsing)
	if (field === 'name') {
		window.userProfile.name = value;
	} else if (field === 'surname') {
		window.userProfile.surname = value;
	} else if (field === 'weight') {
		window.userProfile.weight = parseFloat(value) || 0; // Usiamo 0 come fallback numerico
	} else if (field === 'age') {
		window.userProfile.age = parseInt(value) || 0;
	} else if (field === 'sex') {
		window.userProfile.sex = value;
	}

	try {
		// 2. Prepara la struttura di salvataggio (assicurando che non ci siano undefined)
		const dataToSave = {
			name: window.userProfile.name || '',
			surname: window.userProfile.surname || '',
			weight: window.userProfile.weight || 0,
			age: window.userProfile.age || 0,
			sex: window.userProfile.sex || 'X',
		}
		
		await setDoc(docRef, dataToSave, { merge: true });
		showTemporaryMessage(`Profilo aggiornato (${field} salvato)!`, 'bg-blue-600');
	} catch (error) {
		console.error("Errore nel salvataggio del profilo:", error);
		showTemporaryMessage(`Errore di salvataggio profilo: ${error.message}`, 'bg-red-500');
	}
	renderUserProfileTitle(); // Aggiorna il titolo nell'header
}
window.saveUserProfile = saveUserProfile;

/**
 * Renderizza solo il titolo principale.
 */
function renderUserProfileTitle() {
	const titleElement = document.getElementById('main-title');
	if (titleElement) {
		// Usiamo Nome e Cognome combinati
		const displayName = window.userProfile.name || window.userProfile.surname ? `${window.userProfile.name} ${window.userProfile.surname}` : 'Utente';
		titleElement.textContent = `💪 Piano di allenamento`;
	}
}


// --- FIREBASE INITIALIZATION AND AUTHENTICATION ---

// ** CONFIGURAZIONE REINTRODOTTA **
const MANUAL_FIREBASE_CONFIG = {
	apiKey: "AIzaSyCfTXY1foD8Dr9UxRNzLeOu680aNtIw4TA",
	authDomain: "training-c0b76.firebaseapp.com",
	projectId: "training-c0b76",
	storageBucket: "training-c0b76.firebasestorage.app",
	messagingSenderId: "149618028951",
	appId: "1:149618028951:web:03756bdf1273a4521954d2"
};

// --- FIREBASE INITIALIZATION AND AUTHENTICATION ---

async function initializeFirebase() {
    const MANUAL_FIREBASE_CONFIG = {
        apiKey: "AIzaSyCfTXY1foD8Dr9UxRNzLeOu680aNtIw4TA",
        authDomain: "training-c0b76.firebaseapp.com",
        projectId: "training-c0b76",
        storageBucket: "training-c0b76.firebasestorage.app",
        messagingSenderId: "149618028951",
        appId: "1:149618028951:web:03756bdf1273a4521954d2"
    };

    let firebaseConfig;
    let appId = 'training-davide-app-id';

    // Gestione Configurazione (Canvas vs Manuale)
    const canvasConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    if (Object.keys(canvasConfig).length > 0) {
        firebaseConfig = canvasConfig;
        appId = typeof __app_id !== 'undefined' ? __app_id : appId;
    } else {
        firebaseConfig = MANUAL_FIREBASE_CONFIG;
        appId = firebaseConfig.projectId;
    }

    window.appId = appId;
    window.isPersistenceEnabled = true;

    // Inizializzazione
    window.firebaseApp = initializeApp(firebaseConfig);
    window.db = getFirestore(window.firebaseApp);
    window.auth = getAuth(window.firebaseApp);
    
    // Imposta persistenza locale (così resti loggato se chiudi il browser)
    await setPersistence(window.auth, browserLocalPersistence);

    // Listener di Stato: Gestisce Login e Logout
    onAuthStateChanged(window.auth, (user) => {
        const loginModal = document.getElementById('login-modal');
        const statusContainer = document.getElementById('status-container');

        if (user) {
            // --- UTENTE LOGGATO ---
            console.log("Utente connesso:", user.email);
            window.userId = user.uid; // Usiamo l'ID sicuro di Firebase
            
            // Nascondi schermata login
            if(loginModal) loginModal.classList.add('hidden');
            
            // Aggiorna UI
            const userIdDisplay = document.getElementById('user-id');
            if(userIdDisplay) {
                userIdDisplay.textContent = `Utente: ${user.email}`;
                userIdDisplay.classList.remove('hidden');
            }
            
            // Carica i dati dell'utente
            loadUserProfile().then(() => {
                renderDay(window.activeDay);
                startDataListener(window.activeDay); 
                checkAndRestoreSession(); // Decommenta se hai implementato il restore session
                
                // Nascondi barra di stato
                setTimeout(() => statusContainer?.classList.add('hidden'), 1000);
            });

        } else {
            // --- UTENTE NON LOGGATO ---
            console.log("Nessun utente. In attesa di login.");
            window.userId = null;
            
            // Mostra schermata login (bloccante)
            if(loginModal) loginModal.classList.remove('hidden');
            
            // Nascondi barra di stato (per pulizia)
            if(statusContainer) statusContainer.classList.add('hidden');
        }
    });
}
window.initializeFirebase = initializeFirebase;
// --- FUNZIONE ID STABILE ---
function getStableUserId(firebaseUser) {
	const STORAGE_KEY = 'training_user_id_v1';
	let stored = localStorage.getItem(STORAGE_KEY);
	if (stored) return stored;
	stored = firebaseUser.uid;
	localStorage.setItem(STORAGE_KEY, stored);
	return stored;
}

// --- RESTO DELLE FUNZIONI (necessarie per completezza ma omesse per brevità) ---
function startDataListener(dayId) { /* ... codice invariato ... */ 
	if (!window.db || !window.userId || !window.isPersistenceEnabled) return;
	if (window.unsubscribeListener) { window.unsubscribeListener(); }
	const docRef = getLogDocumentRef(dayId);
	if (!docRef) return;
	window.unsubscribeListener = onSnapshot(docRef, (docSnap) => {
		const currentDay = window.workoutDays[dayId];
		if (!currentDay) return;
		if (docSnap.exists()) {
			const loggedData = docSnap.data();
			if (loggedData.exercises) {
                currentDay.exercises = currentDay.exercises.map((exercise) => {
                    // CORREZIONE BUG SKIP:
                    // Invece di usare l'indice (exIndex), cerchiamo l'esercizio nel log
                    // corrispondente per NOME. Questo gestisce il riordino causato da "Salta per Ora".
                    const loggedExercise = loggedData.exercises.find(le => le.name === exercise.name);
                    return {
                        ...exercise,
                        logged_weights: loggedExercise && loggedExercise.logged_weights ? loggedExercise.logged_weights : {},
                        logged_notes: loggedExercise && loggedExercise.logged_notes ? loggedExercise.logged_notes : "", 
                        // Aggiungiamo anche il recupero della durata cardio (che mancava nel listener)
                        logged_duration: loggedExercise && loggedExercise.logged_duration ? loggedExercise.logged_duration : null,
                    };
                });
            }
		} else {
			currentDay.exercises = currentDay.exercises.map(exercise => ({ ...exercise, logged_weights: {}, logged_notes: "", }));
		}
		if (window.isGuidedMode) {
			renderGuidedMode();
		} else {
			renderDay(dayId);
			calculateTotalTonnageForDay(dayId);
			updateTonnageDisplay();
		}
	}, (error) => {
		console.error("Errore onSnapshot:", error);
		document.getElementById('status-message').textContent = 'Errore nel caricamento dei dati in tempo reale.';
	});
}

async function saveWeight(dayId, exIndex, setIndex, weight) { /* ... codice invariato ... */
	if (!window.isPersistenceEnabled) { showTemporaryMessage('ATTENZIONE: La persistenza è disabilitata. I dati non saranno salvati.', 'bg-red-500'); return; }
	const docRef = getLogDocumentRef(dayId);
	if (!docRef || !window.userId) { showTemporaryMessage('Errore: Utente non autenticato o DB non pronto.', 'bg-red-500'); return; }
	try {
		const currentDay = window.workoutDays[dayId];
		if (!currentDay) throw new Error("Giorno di allenamento non trovato.");
		const setKey = `set_${setIndex + 1}`;
		const weightValue = (weight === '' || weight === null) ? null : parseFloat(weight);
		currentDay.exercises[exIndex].logged_weights = currentDay.exercises[exIndex].logged_weights || {};
		currentDay.exercises[exIndex].logged_weights[setKey] = weightValue;
		if (!window.isGuidedMode) { calculateTotalTonnageForDay(dayId); updateTonnageDisplay(); }
		const dataToSave = {
			dayId: dayId, dayName: currentDay.name,
			exercises: currentDay.exercises.map(ex => ({
				name: ex.name, sets: ex.sets, reps: ex.reps, rest: ex.rest, defaultWeight: ex.defaultWeight, imageUrl: ex.imageUrl,
				logged_weights: ex.logged_weights || {}, logged_notes: ex.logged_notes || "" 
			}))
		};
		await setDoc(docRef, dataToSave, { merge: false });
		saveActiveSession(); // Salva il tonnellaggio aggiornato e il peso inserito
		showTemporaryMessage('Peso salvato con successo!', 'bg-green-600');
	} catch (error) { console.error("Errore nel salvataggio del peso:", error); showTemporaryMessage(`Errore di salvataggio: ${error.message}`, 'bg-red-500'); }
}
window.saveWeight = saveWeight;

async function saveNote(dayId, exIndex, note) { /* ... codice invariato ... */ 
	if (!window.isPersistenceEnabled) { showTemporaryMessage('ATTENZIONE: La persistenza è disabilitata. La nota non sarà salvata.', 'bg-red-500'); return; }
	const docRef = getLogDocumentRef(dayId);
	if (!docRef || !window.userId) { showTemporaryMessage('Errore: Utente non autenticato o DB non pronto.', 'bg-red-500'); return; }
	try {
		const currentDay = window.workoutDays[dayId];
		if (!currentDay) throw new Error("Giorno di allenamento non trovato.");
		currentDay.exercises[exIndex].logged_notes = note;
		const dataToSave = {
			dayId: dayId, dayName: currentDay.name,
			exercises: currentDay.exercises.map(ex => ({
				name: ex.name, sets: ex.sets, reps: ex.reps, rest: ex.rest, defaultWeight: ex.defaultWeight, imageUrl: ex.imageUrl,
				logged_weights: ex.logged_weights || {}, logged_notes: ex.logged_notes || "" 
			}))
		};
		await setDoc(docRef, dataToSave, { merge: false });
		showTemporaryMessage('Nota salvata con successo!', 'bg-green-600');
		saveActiveSession();
	} catch (error) { console.error("Errore nel salvataggio della nota:", error); showTemporaryMessage(`Errore di salvataggio nota: ${error.message}`, 'bg-red-500'); }
}
window.saveNote = saveNote;

/**
 * MODIFICATA: Mostra un messaggio nella nuova barra di notifica floating.
 */
function showTemporaryMessage(message, colorClass) {
	const container = document.getElementById('floating-notification-container');
	const bar = document.getElementById('floating-notification-bar');
	const text = document.getElementById('floating-notification-text');

	if (!container || !bar || !text) {
		console.warn("Elementi notifica floating non trovati.");
		return; 
	}

	// 1. Cancella il timer precedente se una notifica è già attiva
	if (window.floatingNotificationTimer) {
		clearTimeout(window.floatingNotificationTimer);
	}

	// 2. Imposta testo e colore
	text.textContent = message;

	// Rimuovi tutte le vecchie classi di colore
	bar.classList.remove('bg-red-500', 'bg-green-600', 'bg-blue-600', 'bg-yellow-600', 'bg-purple-600', 'bg-gray-600');
	// Aggiungi la nuova classe di colore
	bar.classList.add(colorClass);

	// 3. Mostra la barra facendola scorrere verso il basso
	container.classList.remove('-translate-y-full');

	// 4. Imposta il timer per l'auto-chiusura (5 secondi)
	window.floatingNotificationTimer = setTimeout(() => {
		closeFloatingNotification();
	}, 5000); // 5 secondi, come hai richiesto
}
// window.showTemporaryMessage = showTemporaryMessage;

async function generateExerciseTip(exerciseName, exerciseElement) { /* ... codice invariato ... */
	const apiKey = "AIzaSyDQWJzCNs3nhLll9iEwj3P5zEeeFruooQ4";
	const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
	const button = document.getElementById(`tip-btn-${exerciseElement.id.replace('tip-output-', '')}`);
	if (button) button.disabled = true;
	exerciseElement.innerHTML = '<span class="text-yellow-400">Analisi in corso... ✨</span>';
	const systemPrompt = "Sei un personal trainer esperto e conciso. Fornisci un breve consiglio in italiano sulla corretta esecuzione dell'esercizio e indica i principali muscoli coinvolti, massimo 100 parole.";
	const userQuery = `Fornisci un consiglio per l'esercizio: ${exerciseName}`;
	const payload = { contents: [{ parts: [{ text: userQuery }] }], systemInstruction: { parts: [{ text: systemPrompt }] }, tools: [{ "google_search": {} }] };
	try {
		let response; let attempt = 0; const MAX_ATTEMPTS = 3;
		while (attempt < MAX_ATTEMPTS) {
			attempt++;
			try {
				response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
				if (response.ok) break;
				if (response.status === 429) { await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000)); continue; }
				throw new Error(`HTTP error! status: ${response.status}`);
			} catch (e) {
				if (attempt === MAX_ATTEMPTS) throw e;
				await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
			}
		}
		const result = await response.json();
		const text = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Nessun consiglio generato.';
		let sourceHtml = ''; const groundingMetadata = result.candidates?.[0]?.groundingMetadata;
		if (groundingMetadata && groundingMetadata.groundingAttributions) {
			const sources = groundingMetadata.groundingAttributions
				.map(attr => ({ uri: attr.web?.uri, title: attr.web?.title, }))
				.filter(source => source.uri && source.title);
			if (sources.length > 0) {
				sourceHtml = `<p class="text-xs text-gray-500 mt-2 italic border-t border-gray-700 pt-2">Fonte: <a href="${sources[0].uri}" target="_blank" class="text-blue-400 hover:text-blue-300 transition duration-150">${sources[0].title}</a></p>`;
			}
		}
		exerciseElement.innerHTML = `<p class="text-sm text-gray-300 whitespace-pre-wrap">${text}</p>${sourceHtml}`;
	} catch (error) { console.error("Errore Gemini API:", error); exerciseElement.innerHTML = `Errore API: Impossibile generare il consiglio. Riprova più tardi.`; } finally { if (button) button.disabled = false; }
}
window.generateExerciseTip = generateExerciseTip;

// --- NUOVO: Disegna il grafico di progressione per un allenamento specifico ---
function renderProgressionChart(workoutName) {
    const canvas = document.getElementById('progressionChart');
    if (!canvas) return;
    
    // Distruggi il grafico precedente se esiste
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    // Recuperiamo i dati dalla cache globale (che popoleremo nel prossimo passo)
    if (!window.cachedHistoryData) return;

    // 1. Filtra i dati solo per questo tipo di allenamento
    // 2. Ordina per data (dal più vecchio al più recente) per vedere la linea temporale corretta
    const data = window.cachedHistoryData
        .filter(log => log.dayName === workoutName)
        .sort((a, b) => new Date(a.date + 'T' + a.endTime) - new Date(b.date + 'T' + b.endTime));

    if (data.length === 0) {
        // Gestione caso nessun dato (magari mostra un messaggio o un grafico vuoto)
        return;
    }

    const labels = data.map(d => {
        // Formatta la data es. "18/12"
        const dateObj = new Date(d.date);
        return `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
    });
    const tonnages = data.map(d => d.totalTonnage);

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Volume Totale (kg)',
                data: tonnages,
                borderColor: '#10b981', // Verde smeraldo
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                borderWidth: 2,
                tension: 0.3, // Linea curva morbida
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#10b981',
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { 
                    ticks: { color: '#9ca3af' }, 
                    grid: { color: 'rgba(255, 255, 255, 0.05)' } 
                },
                y: { 
                    beginAtZero: false, // Non partire da 0 per evidenziare meglio i miglioramenti
                    ticks: { color: '#9ca3af' }, 
                    grid: { color: 'rgba(255, 255, 255, 0.05)' } 
                }
            },
            plugins: {
                legend: { labels: { color: 'white' } },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
}
window.renderProgressionChart = renderProgressionChart;
function getImageUrl(exercise) { 
	return exercise.imageUrl || `https://placehold.co/400x200/800080/ffffff/png?text=IMMAGINE+PER+${encodeURIComponent(exercise.name.toUpperCase().replace(/\s/g, '+'))}`; 
}
function calculateTonnageForSet(repsString, weight) {
    const w = parseFloat(weight);
    if (isNaN(w) || w === null || w <= 0) { return 0; }

    // 1. Parsing Ripetizioni (estrae i numeri)
    let repsMatch = repsString.match(/(\d+)/);
    let reps = repsMatch ? parseInt(repsMatch[1], 10) : 1;

    // Gestione range (es. "8-12" diventa 10)
    if (repsString.includes('-') && repsMatch) {
        const parts = repsString.split('-').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        if (parts.length === 2) {
            reps = Math.floor((parts[0] + parts[1]) / 2);
        }
    }
    // 2. Controllo Moltiplicatore "Per Braccio"
    // Cerca stringhe come "(x braccio)" o "(per braccio)" o "(x lato)"
    // La 'i' finale rende la ricerca insensibile alle maiuscole/minuscole
    const isPerArm = /x\s*braccio|per\s*braccio|x\s*lato|per\s*lato/i.test(repsString);

    // Se è per braccio, moltiplichiamo il peso per 2 (destro + sinistro)
    const multiplier = isPerArm ? 2 : 1;
    return reps * w * multiplier;
}
window.calculateTonnageForSet = calculateTonnageForSet;

function calculateTotalTonnageForDay(dayId) { /* ... codice invariato ... */
	window.totalTonnage = 0; const currentDay = window.workoutDays[dayId]; if (!currentDay) return;
	currentDay.exercises.forEach(ex => {
		if (ex.logged_weights) {
			for (const sKey in ex.logged_weights) { window.totalTonnage += calculateTonnageForSet(ex.reps, ex.logged_weights[sKey]); }
		}
	});
}
window.calculateTotalTonnageForDay = calculateTotalTonnageForDay;

function updateTonnageDisplay() { /* ... codice invariato ... */
	const tonnageElement = document.getElementById('total-tonnage-display');
	if (tonnageElement) { tonnageElement.textContent = `Tonnellaggio: ${Math.round(window.totalTonnage).toLocaleString('it-IT')} kg`; tonnageElement.classList.remove('hidden'); }
}
window.updateTonnageDisplay = updateTonnageDisplay;

function getRestTimeSeconds(restString) { /* ... codice invariato ... */
	const match = restString.match(/(\d+)/); return match ? parseInt(match[1], 10) : 0;
}

function updateTimerDisplay(timerId, seconds, isGuided = false) { /* ... codice invariato ... */
	const minutes = Math.floor(seconds / 60); const secs = seconds % 60; const display = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	const displayElement = document.getElementById(timerId); if (!displayElement) return;
	displayElement.textContent = display;
	const button = document.getElementById(timerId.replace('timer-display', 'timer-button'));
	const terminateButton = document.getElementById(timerId.replace('timer-display', 'terminate-button'));
	const timerState = activeTimers[timerId];
	if (seconds > 0) {
		 displayElement.classList.remove('text-green-500', 'font-bold'); displayElement.classList.add('text-white');
		 if (seconds <= 5) { displayElement.classList.add('text-red-500'); } else { displayElement.classList.remove('text-red-500'); }
		 if (button) {
			 button.classList.remove('bg-yellow-600', 'hover:bg-yellow-700', 'bg-green-600', 'hover:bg-green-700', 'bg-red-600');
			 if (timerState && timerState.isRunning) {
				 button.textContent = `RIPOSO IN CORSO`; button.classList.add('bg-blue-600', 'hover:bg-blue-700');
				 if (terminateButton) terminateButton.classList.remove('hidden');
			 } else {
				 button.textContent = 'Avvia Riposo'; button.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
				 if (terminateButton) terminateButton.classList.add('hidden');
			 }
		 }
	} else {
		displayElement.textContent = '00:00'; displayElement.classList.remove('text-white', 'text-red-500'); displayElement.classList.add('font-bold', 'text-green-500');
		if (terminateButton) terminateButton.classList.add('hidden');
		if (button) {
			 button.textContent = isGuided ? 'PROSSIMA SERIE/ESERCIZIO' : 'Avvia Riposo';
			 button.classList.remove('bg-indigo-600', 'hover:bg-indigo-700', 'bg-blue-600', 'hover:bg-blue-700');
			 button.classList.add('bg-green-600', 'hover:bg-green-700');
		}
		if (isGuided && isRestPeriodActive) {
			isRestPeriodActive = false; showTemporaryMessage('Riposo terminato! Pronto per il prossimo passo.', 'bg-green-600');
			if ('vibrate' in navigator) { navigator.vibrate(500); }
		}
	}
}
let activeTimers = {}; let isRestPeriodActive = false;
function startTimer(dayId, exIndex, restString, isGuided = false) { 
	const timerId = `timer-display-${dayId}-${exIndex}`; const durationSeconds = getRestTimeSeconds(restString);
	if (durationSeconds <= 0) { if (isGuided) { nextStep(); } else { showTemporaryMessage(`Nessun tempo di riposo specificato per questo esercizio.`, 'bg-red-500'); } return; }
	if (activeTimers[timerId] && activeTimers[timerId].interval) { clearInterval(activeTimers[timerId].interval); }
	activeTimers[timerId] = { seconds: durationSeconds, isRunning: true, interval: null, }; isRestPeriodActive = true;
	const interval = setInterval(() => {
		if (activeTimers[timerId].isRunning) { activeTimers[timerId].seconds--; updateTimerDisplay(timerId, activeTimers[timerId].seconds, isGuided);
			if (activeTimers[timerId].seconds <= 0) { clearInterval(interval); activeTimers[timerId].isRunning = false; activeTimers[timerId].interval = null; }
		}
	}, 1000);
	activeTimers[timerId].interval = interval; showTemporaryMessage(`Riposo di ${durationSeconds} secondi iniziato.`, 'bg-blue-600'); updateTimerDisplay(timerId, durationSeconds, isGuided);
}
// --- NUOVO: Gestione Modale Riposo ---
let restModalInterval = null;

function openRestModal(durationString) {
    const seconds = getRestTimeSeconds(durationString);
    if (seconds <= 0) {
        // Se non c'è riposo, passa subito avanti
        nextStep();
        return;
    }

    const modal = document.getElementById('rest-timer-modal');
    const display = document.getElementById('modal-timer-display');
    
    // Mostra il modale
    modal.classList.remove('hidden');
    
    // Logica Timer
    let timeLeft = seconds;
    
    // Funzione interna per aggiornare il display
    const updateDisplay = () => {
        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
        const s = (timeLeft % 60).toString().padStart(2, '0');
        display.textContent = `${m}:${s}`;
        
        // Cambio colore negli ultimi 5 secondi
        if (timeLeft <= 5) {
            display.classList.add('text-red-500');
            display.classList.remove('text-white');
        } else {
            display.classList.add('text-white');
            display.classList.remove('text-red-500');
        }
    };

    updateDisplay(); // Primo render immediato

    // Pulisce eventuali interval precedenti
    if (restModalInterval) clearInterval(restModalInterval);

    restModalInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();

        if (timeLeft <= 0) {
            // Tempo scaduto: Vibrazione e Avanti
            if ('vibrate' in navigator) navigator.vibrate([500, 300, 500]);
            finishRestAndNext();
        }
    }, 1000);
}
window.openRestModal = openRestModal;

function finishRestAndNext() {
    // 1. Ferma il timer
    if (restModalInterval) {
        clearInterval(restModalInterval);
        restModalInterval = null;
    }
    
    // 2. Nascondi il modale
    const modal = document.getElementById('rest-timer-modal');
    modal.classList.add('hidden');
    
    // 3. Passa al prossimo step
    nextStep();
}
window.finishRestAndNext = finishRestAndNext;

function startTotalTimer() {
    if (window.totalTimerInterval) { clearInterval(window.totalTimerInterval); }
    const timerElement = document.getElementById('total-timer');
    if (timerElement) { 
        timerElement.classList.remove('hidden', 'font-extrabold', 'text-xl'); 
        timerElement.classList.add('text-lg'); 
        // Se stiamo riprendendo, mostra subito il tempo corrente invece di aspettare 1 secondo
        updateTimerUI(timerElement);
    }

    // Memorizziamo l'istante preciso dell'ultimo "tick"
    let lastTickTime = Date.now();

    window.totalTimerInterval = setInterval(() => {
        const now = Date.now();
        const deltaMillis = now - lastTickTime;

        // Se è passato almeno 1 secondo (1000ms)
        if (deltaMillis >= 1000) {
            // Calcoliamo quanti secondi sono passati realmente (es. se il telefono ha dormito per 5 minuti, delta sarà 300.000)
            const secondsPassed = Math.floor(deltaMillis / 1000);
            
            window.totalTimeSeconds += secondsPassed;
            
            // Aggiorniamo il riferimento temporale sottraendo l'eccesso per mantenere precisione
            lastTickTime = now - (deltaMillis % 1000);

            updateTimerUI(timerElement);
        }
    }, 1000);
}

// Funzione helper per aggiornare il testo (per non duplicare codice)
function updateTimerUI(element) {
    if (!element) return;
    const hours = Math.floor(window.totalTimeSeconds / 3600); 
    const minutes = Math.floor((window.totalTimeSeconds % 3600) / 60); 
    const seconds = window.totalTimeSeconds % 60;
    const display = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    element.textContent = `Durata totale: ${display}`;
}
function stopTotalTimer() { /* ... codice invariato ... */
	if (window.totalTimerInterval) { clearInterval(window.totalTimerInterval); window.totalTimerInterval = null; }
	const hours = Math.floor(window.totalTimeSeconds / 3600); const minutes = Math.floor((window.totalTimeSeconds % 3600) / 60); const seconds = window.totalTimeSeconds % 60; const finalTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	const timerElement = document.getElementById('total-timer');
	if (timerElement) { timerElement.textContent = `Durata finale: ${finalTime}`; timerElement.classList.remove('text-lg'); timerElement.classList.add('font-extrabold', 'text-xl'); }
}
/**
 * NUOVA FORMULA (Basata su METs + Tonnellaggio):
 * Stima basata sulla durata (fattore principale) + un bonus per il volume spostato.
 * @param {number} totalTonnage - Tonnellaggio totale in kg.
 * @param {number} bodyWeight - Peso corporeo dell'utente in kg.
 * @param {number} durationSeconds - Durata allenamento in secondi.
 */
function estimateWeightCalories(totalTonnage, bodyWeight, durationSeconds) {
    if (bodyWeight <= 0 || durationSeconds <= 0) return 0;
    
    // 1. Calcolo base MET (Metabolic Equivalent of Task)
    // Weight lifting vigoroso è circa 6.0, moderato è 3.5-4.0.
    // Usiamo 4.5 come media realistica (considerando le pause).
    const MET = 4.5; 
    const durationHours = durationSeconds / 3600;
    
    // Formula standard: Kcal = MET * Kg * Ore
    let timeBasedCalories = MET * bodyWeight * durationHours;

    // 2. Bonus Tonnellaggio (Piccolo extra per premiare il volume)
    // Stima: circa 0.5 kcal extra ogni 1000kg spostati (oltre al metabolismo basale)
    const volumeBonus = (totalTonnage / 1000) * 0.5;
    
    const totalCalories = timeBasedCalories + volumeBonus;

    // Arrotonda all'intero
    return Math.round(totalCalories);
}
window.estimateWeightCalories = estimateWeightCalories;
function terminateRest(dayId, exIndex) { /* ... codice invariato ... */
	const timerId = `timer-display-${dayId}-${exIndex}`; const timerState = activeTimers[timerId];
	if (timerState && timerState.interval) { clearInterval(timerState.interval); timerState.interval = null; timerState.isRunning = false; timerState.seconds = 0; isRestPeriodActive = false;
		showTemporaryMessage('Riposo terminato in anticipo. Avanti il prossimo passo!', 'bg-yellow-600'); updateTimerDisplay(timerId, 0, true); }
}
window.terminateRest = terminateRest;
function toggleTimer(dayId, exIndex, restString, isGuided = false) { /* ... codice invariato ... */
	const timerId = `timer-display-${dayId}-${exIndex}`; const durationSeconds = getRestTimeSeconds(restString);
	if (durationSeconds <= 0) { if (isGuided) nextStep(); return; }
	const timerState = activeTimers[timerId];
	if (!timerState || !timerState.isRunning) {
		if (timerState && timerState.seconds <= 0 && isGuided) { nextStep(); } else { startTimer(dayId, exIndex, restString, isGuided); } return;
	}
}
window.toggleTimer = toggleTimer;
function startGuidedMode(isResuming = false) {
    window.isGuidedMode = true;
    
    if (!isResuming) {
        // Se NON stiamo riprendendo, azzera tutto come al solito
        window.currentExIndex = 0; 
        window.currentSet = 1; 
        window.totalTonnage = 0; 
        window.exerciseTonnageMap = {}; 
        window.totalCalories = 0;
        window.totalTimeSeconds = 0;
    }
    
    // Avvia interfaccia
    startTotalTimer();
    document.getElementById('day-tabs').classList.add('hidden'); 
    document.getElementById('mode-toggle-button').classList.add('hidden');
    document.getElementById('guided-controls-container').classList.remove('hidden'); 
    
    updateTonnageDisplay(); 
    renderGuidedMode();
    
    if (!isResuming) {
        showTemporaryMessage('Modalità Guidata avviata. Inizia il tuo allenamento!', 'bg-blue-600');
        saveActiveSession(); // Salva subito lo stato iniziale
    }
}
window.startGuidedMode = startGuidedMode;
/**
 * MODIFICATA: Interrompe l'allenamento e mostra la schermata di riepilogo/valutazione.
 */
function stopGuidedMode() {
	// 1. Ferma il timer
	stopTotalTimer(); 

	// 2. Ottieni i dati
	const dayData = window.workoutDays[window.activeDay];
	const dayName = dayData ? dayData.name : "Allenamento";

	// 3. Calcola le calorie (passiamo anche totalTimeSeconds)
    const currentWeight = window.userProfile.weight > 0 ? window.userProfile.weight : 70;
    window.totalCalories = estimateWeightCalories(window.totalTonnage, currentWeight, window.totalTimeSeconds);

	// 4. Mostra la schermata di riepilogo e valutazione
	// (Questo codice è copiato da nextStep, ma con titolo diverso)
	showTemporaryMessage(`Allenamento Interrotto in ${document.getElementById('total-timer').textContent.split(': ').pop()}`, 'bg-yellow-600');

	document.getElementById('workout-content').innerHTML = 
		`<div class="p-8 text-center bg-gray-700 rounded-xl shadow-2xl">` +
			`<h2 class="text-4xl font-extrabold text-yellow-400 mb-4">✋ ALLENAMENTO INTERROTTO</h2>` +
			`<p class="text-xl text-gray-300">Hai terminato in anticipo. Salva i tuoi progressi parziali.</p>` +
			`<p class="text-2xl font-extrabold text-green-400 mt-4">Volume Totale: ${Math.round(window.totalTonnage).toLocaleString('it-IT')} kg</p>` +
			`<p class="text-2xl font-extrabold text-red-400 mt-2">🔥 Calorie Stimate: ${window.totalCalories.toLocaleString('it-IT')} kcal</p>` +
			`<p id="final-time-display" class="text-2xl font-extrabold text-white mt-4">${document.getElementById('total-timer').textContent}</p>` +

			`<!-- Selettore Stelle -->` +
			`<div class="mt-6">` +
				`<p class="text-lg text-gray-300 mb-2">Come valuti questo allenamento?</p>` +
				`<div class="flex justify-center items-center space-x-2 text-4xl cursor-pointer">` +
					`<span class="rating-star text-gray-600 hover:text-yellow-500 transition-colors" onclick="window.setRating(1)">&#9734;</span>` +
					`<span class="rating-star text-gray-600 hover:text-yellow-500 transition-colors" onclick="window.setRating(2)">&#9734;</span>` +
					`<span class="rating-star text-gray-600 hover:text-yellow-500 transition-colors" onclick="window.setRating(3)">&#9734;</span>` +
					`<span class="rating-star text-gray-600 hover:text-yellow-500 transition-colors" onclick="window.setRating(4)">&#9734;</span>` +
					`<span class="rating-star text-gray-600 hover:text-yellow-500 transition-colors" onclick="window.setRating(5)">&#9734;</span>` +
				`</div>` +
			`</div>` +

			`<!-- Bottone Salva e Torna (chiama la funzione che ora funziona) -->` +
			`<button onclick="window.saveAndExitGuidedMode('${dayName}')" class="mt-8 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 transition duration-150 shadow-lg">Salva e Torna</button>` +
		`</div>`;

	// 5. Pulisci la UI (ma non le variabili)
	window.isGuidedMode = false;
	isRestPeriodActive = false;
	document.getElementById('guided-controls-container').classList.add('hidden');
}
window.stopGuidedMode = stopGuidedMode;

/**
 * NUOVA FUNZIONE INTERNA:
 * Pulisce e resetta la UI alla fine della modalità guidata.
 */
function __internal_cleanup_guided_mode() {
	clearActiveSession(); // Rimuove il salvataggio temporaneo
	// 5. Azzera tutte le variabili globali
	window.isGuidedMode = false; 
	window.currentExIndex = 0; 
	window.currentSet = 1; 
	window.totalTonnage = 0; 
	window.exerciseTonnageMap = {}; 
	isRestPeriodActive = false;
	window.totalCalories = 0;
	window.currentWorkoutRating = 0; // Resetta la valutazione

	// 6. Ferma tutti i timer attivi
	for (const timerId in activeTimers) { 
		if (activeTimers[timerId] && activeTimers[timerId].interval) { 
			clearInterval(activeTimers[timerId].interval); 
		} 
	} 
	activeTimers = {};

	// 7. Ripristina l'interfaccia
	document.getElementById('day-tabs').classList.remove('hidden'); 
	document.getElementById('mode-toggle-button').classList.remove('hidden');
	document.getElementById('guided-controls-container').classList.add('hidden'); 

	// 8. Renderizza la visualizzazione standard
	renderDay(window.activeDay);
}
window.__internal_cleanup_guided_mode = __internal_cleanup_guided_mode;
/**
 * NUOVA FUNZIONE: Salta un esercizio spostandolo alla fine della lista.
 */
function skipExercise() {
	const dayId = window.activeDay;
	const exIndex = window.currentExIndex;

	// Dobbiamo usare la lista di esercizi del giorno attivo
	const dayExercises = window.workoutDays[dayId].exercises;

	// Non puoi saltare l'ultimo esercizio
	if (exIndex >= dayExercises.length - 1) {
		showTemporaryMessage('Non puoi saltare l\'ultimo esercizio.', 'bg-red-500');
		return;
	}

	// 1. Rimuovi l'esercizio corrente dalla sua posizione
	// usiamo splice(indice, 1)[0] per estrarlo
	const exerciseToMove = dayExercises.splice(exIndex, 1)[0];

	// 2. Aggiungilo alla fine dell'array
	dayExercises.push(exerciseToMove);

	// 3. Resetta il contatore delle serie per il nuovo esercizio
	//    (altrimenti inizierebbe dalla serie 2 o 3)
	window.currentSet = 1;

	// 4. Mostra un messaggio
	showTemporaryMessage(`'${exerciseToMove.name}' saltato. Verrà riproposto alla fine.`, 'bg-blue-600');

	// 5. Ricarica la vista guidata (mostrerà il nuovo es. all'indice corrente)
	renderGuidedMode();
	saveActiveSession(); // Salva il nuovo ordine degli esercizi
}
window.skipExercise = skipExercise;
/**
 * Disegna il grafico settimanale utilizzando Chart.js
 */
function renderWeeklyChart() {
	const canvasElement = document.getElementById('weeklyChart');
	if (!canvasElement) {
		console.warn("Elemento Canvas 'weeklyChart' non trovato.");
		return;
	}
	
	// --- NUOVO: Distrugge il grafico precedente se esiste ---
	const existingChart = Chart.getChart(canvasElement);
	if (existingChart) {
		existingChart.destroy();
	}
	// --- FINE NUOVO CODICE ---
	const dataDumpElement = document.getElementById('chart-data-dump');

	if (!dataDumpElement || !canvasElement) return;

	try {
		const rawData = JSON.parse(dataDumpElement.value);
		
		// Filtra e prepara i dati per gli assi
		const days = rawData.map(d => d.day);
		const tonnageValues = rawData.map(d => d.totalTonnage);
		const calorieValues = rawData.map(d => d.totalCalories);

		// Se Chart.js è caricato
		if (typeof Chart !== 'undefined') {
			new Chart(canvasElement, {
				type: 'bar',
				data: {
					labels: days,
					datasets: [
						{
							type: 'bar',
							label: 'Tonnellaggio (kg)',
							data: tonnageValues,
							backgroundColor: 'rgba(59, 130, 246, 0.8)', // Blu
							borderColor: 'rgba(59, 130, 246, 1)',
							borderWidth: 1,
							yAxisID: 'y-tonnage',
							order: 2,
						},
						{
							type: 'line',
							label: 'Calorie (kcal)',
							data: calorieValues,
							borderColor: 'rgba(239, 68, 68, 1)', // Rosso
							backgroundColor: 'rgba(239, 68, 68, 0.2)',
							fill: true,
							yAxisID: 'y-calories',
							order: 1,
							tension: 0.4
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: {
						x: {
							ticks: { color: 'white' },
							grid: { color: 'rgba(255, 255, 255, 0.1)' }
						},
						'y-tonnage': {
							type: 'linear',
							position: 'left',
							title: { display: true, text: 'Tonnellaggio (kg)', color: 'white' },
							ticks: { color: 'white' },
							grid: { color: 'rgba(255, 255, 255, 0.1)' },
							min: 0,
							suggestedMax: Math.max(...tonnageValues) * 1.2 || 1000 // Aumenta il massimo per leggibilità
						},
						'y-calories': {
							type: 'linear',
							position: 'right',
							title: { display: true, text: 'Calorie (kcal)', color: 'white' },
							ticks: { color: 'white' },
							grid: { drawOnChartArea: false }, // Disegna solo per l'asse Tonnellaggio
							min: 0,
							suggestedMax: Math.max(...calorieValues) > 0 ? Math.max(...calorieValues) * 1.2 : 100 // <-- AGGIUNGI QUESTO
						}
					},
					plugins: {
						legend: { labels: { color: 'white' } }
					}
				}
			});
			// Nascondi l'elemento temporaneo di caricamento
			document.getElementById('weekly-chart-container').classList.remove('min-h-[250px]');
		} else {
			 console.error("Chart.js non è definito. Assicurati che il CDN sia caricato correttamente.");
		}

	} catch (e) {
		console.error("Errore durante il parsing o il rendering del grafico:", e);
	}
}
async function logWorkoutHistory(dayName, rating) {
	const historyColRef = getHistoryCollectionRef();
	if (!historyColRef) return;

	const timestamp = new Date();
	
	const workoutLog = {
		date: timestamp.toISOString().split('T')[0], // Data (es. 2025-11-04)
		startTime: new Date(timestamp.getTime() - window.totalTimeSeconds * 1000).toLocaleTimeString('it-IT'),
		endTime: timestamp.toLocaleTimeString('it-IT'),
		durationSeconds: window.totalTimeSeconds,
		durationDisplay: `${Math.floor(window.totalTimeSeconds / 3600).toString().padStart(2, '0')}:${Math.floor((window.totalTimeSeconds % 3600) / 60).toString().padStart(2, '0')}:${(window.totalTimeSeconds % 60).toString().padStart(2, '0')}`,
		dayName: dayName,
		totalTonnage: Math.round(window.totalTonnage),
		estimatedCalories: Math.round(window.totalCalories || 0),
		rating: rating || 0 
	};

	try {
		// Usiamo addDoc per creare un nuovo documento con ID automatico
		// await setDoc(doc(historyColRef), workoutLog); 
		await addDoc(historyColRef, workoutLog);
		showTemporaryMessage('Allenamento salvato nello storico!', 'bg-green-600');
	} catch (error) {
		console.error("Errore nel log dello storico:", error);
		showTemporaryMessage(`Errore nel salvataggio storico: ${error.message}`, 'bg-red-500');
	}
}
window.stopGuidedMode = stopGuidedMode;
function nextStep() { 
	const dayData = window.workoutDays[window.activeDay]; const currentExercise = dayData.exercises[window.currentExIndex]; const setKey = `set_${window.currentSet}`;
	const isTimedExercise = currentExercise.sets === 0 || currentExercise.rest === "N/A" || !currentExercise.sets;
	if (!isTimedExercise) {
	   // --- INIZIO CORREZIONE TONNELLAGGIO ---
		let weightToCalculate = null;
		let weightNeedsSaving = false; // Flag per salvare il default
		
		// 1. Controlla se esiste un peso loggato (salvato da 'onchange')
		if (currentExercise.logged_weights && currentExercise.logged_weights[setKey] !== undefined && currentExercise.logged_weights[setKey] !== null) {
			weightToCalculate = parseFloat(currentExercise.logged_weights[setKey]);
		} 
		// 2. Altrimenti, se l'utente non ha toccato l'input, usa il defaultWeight
		else if (currentExercise.defaultWeight && currentExercise.defaultWeight > 0) {
			weightToCalculate = parseFloat(currentExercise.defaultWeight);
			// Dobbiamo salvare questo default per coerenza
			weightNeedsSaving = true; 
		}
		
		// Calcola il tonnellaggio solo se abbiamo un peso valido
		if (weightToCalculate !== null && weightToCalculate > 0) {
			const tonnage = calculateTonnageForSet(currentExercise.reps, weightToCalculate); 
			window.totalTonnage += tonnage; 
			window.exerciseTonnageMap[window.currentExIndex] = (window.exerciseTonnageMap[window.currentExIndex] || 0) + tonnage; 
			updateTonnageDisplay();
		
			// Se stiamo usando il peso di default, salviamolo ora in background
			if (weightNeedsSaving && window.isPersistenceEnabled) {
				// Chiamiamo saveWeight in background (non c'è bisogno di 'await')
				// (dayId, exIndex, setIndex, weight)
				window.saveWeight(window.activeDay, window.currentExIndex, window.currentSet - 1, weightToCalculate);
			}
		} else { 
			// Non mostrare un errore, l'utente potrebbe aver saltato la serie (peso 0 o nullo)
			console.log(`Set ${window.currentSet} saltato (nessun peso) per ${currentExercise.name}. Tonnellaggio non aggiunto.`);
		}
		// --- FINE CORREZIONE TONNELLAGGIO ---
	}
	const timerId = `timer-display-${window.activeDay}-${window.currentExIndex}`; if (activeTimers[timerId] && activeTimers[timerId].interval) { clearInterval(activeTimers[timerId].interval); } activeTimers[timerId] = null;
	if (!isTimedExercise && window.currentSet < currentExercise.sets) {
		window.currentSet++; 
		saveActiveSession();
		showTemporaryMessage(`Prossima serie: ${window.currentSet} di ${currentExercise.sets}. Inizia la tua serie.`, 'bg-blue-600'); renderGuidedMode(); return;
	}
	const nextExIndex = window.currentExIndex + 1;
	if (nextExIndex < dayData.exercises.length) {
		window.currentExIndex = nextExIndex; 
		window.currentSet = 1; 
		saveActiveSession();
		showTemporaryMessage(`Esercizio successivo: ${dayData.exercises[nextExIndex].name}.`, 'bg-green-600'); renderGuidedMode(); return;
	}
	stopTotalTimer(); 
    // NUOVO: Calcola le calorie stimate totali (MET + Volume)
    const currentWeight = window.userProfile.weight > 0 ? window.userProfile.weight : 70;
    // Aggiunto terzo parametro window.totalTimeSeconds
    window.totalCalories = estimateWeightCalories(window.totalTonnage, currentWeight, window.totalTimeSeconds);
	// *** NUOVA CHIAMATA PER LOGGARE L'ALLENAMENTO ***
	//logWorkoutHistory(dayData.name); 
	// ***********************************************
	showTemporaryMessage(`Allenamento terminato in ${document.getElementById('total-timer').textContent.split(': ').pop()}!`, 'bg-purple-600');
	document.getElementById('workout-content').innerHTML = `<div class="p-8 text-center bg-gray-700 rounded-xl shadow-2xl"><h2 class="text-4xl font-extrabold text-green-400 mb-4">🏆 ALLENAMENTO COMPLETATO! 🥳</h2>
	<p class="text-xl text-gray-300">Complimenti! Hai completato tutti gli esercizi per ${dayData.name}.</p>
	<p class="text-2xl font-extrabold text-yellow-400 mt-4">Volume Totale: ${Math.round(window.totalTonnage).toLocaleString('it-IT')} kg</p>
	<p class="text-2xl font-extrabold text-red-400 mt-2">🔥 Calorie Stimate: ${window.totalCalories.toLocaleString('it-IT')} kcal</p>
	// ...
	<p id="final-time-display" class="text-2xl font-extrabold text-white mt-4">${document.getElementById('total-timer').textContent}</p>` +
	
	`<!-- NUOVO: Selettore Stelle -->` +
	`<div class="mt-6">` +
		`<p class="text-lg text-gray-300 mb-2">Come valuti questo allenamento?</p>` +
		`<div class="flex justify-center items-center space-x-2 text-4xl cursor-pointer">` +
			`<span class="rating-star text-gray-600 hover:text-yellow-500 transition-colors" onclick="window.setRating(1)">&#9734;</span>` +
			`<span class="rating-star text-gray-600 hover:text-yellow-500 transition-colors" onclick="window.setRating(2)">&#9734;</span>` +
			`<span class="rating-star text-gray-600 hover:text-yellow-500 transition-colors" onclick="window.setRating(3)">&#9734;</span>` +
			`<span class="rating-star text-gray-600 hover:text-yellow-500 transition-colors" onclick="window.setRating(4)">&#9734;</span>` +
			`<span class="rating-star text-gray-600 hover:text-yellow-500 transition-colors" onclick="window.setRating(5)">&#9734;</span>` +
		`</div>` +
	`</div>` +
	
	`<!-- MODIFICATO: Bottone Salva e Torna -->` +
	`<button onclick="window.saveAndExitGuidedMode('${dayData.name}')" class="mt-8 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 transition duration-150 shadow-lg">Salva e Torna</button>` +
	`</div>`;
	window.isGuidedMode = false; window.currentExIndex = 0; window.currentSet = 1; isRestPeriodActive = false; document.getElementById('guided-controls-container').classList.add('hidden');
}
window.nextStep = nextStep;
/**
 * Salva lo storico (con la valutazione) e esce dalla modalità guidata.
 */
async function saveAndExitGuidedMode(dayName) {
	// 1. Salva i dati, passando la valutazione
	await logWorkoutHistory(dayName, window.currentWorkoutRating);
	
	// 2. Resetta la valutazione per il prossimo allenamento
	window.currentWorkoutRating = 0;
	
	// 3. Chiudi la modalità guidata
	window.__internal_cleanup_guided_mode();
}
window.saveAndExitGuidedMode = saveAndExitGuidedMode;
function renderGuidedMode() { 
	const dayData = window.workoutDays[window.activeDay]; const contentDiv = document.getElementById('workout-content');
	if (window.currentExIndex >= dayData.exercises.length) { nextStep(); return; }
	const exercise = dayData.exercises[window.currentExIndex]; const exIndex = window.currentExIndex; const restSeconds = getRestTimeSeconds(exercise.rest); const timerId = `timer-display-${window.activeDay}-${exIndex}`;
	const isTimedExercise = exercise.sets === 0 || exercise.rest === "N/A" || !exercise.sets; if (isTimedExercise) { window.currentSet = 1; }
	const setKey = `set_${window.currentSet}`;
	const currentWeight = (exercise.logged_weights && exercise.logged_weights[setKey] !== undefined && exercise.logged_weights[setKey] !== null) ? exercise.logged_weights[setKey] : exercise.defaultWeight || '';
	const currentExTonnage = Math.round(window.exerciseTonnageMap[exIndex] || 0);
	const isTimerRunning = activeTimers[timerId] && activeTimers[timerId].isRunning && activeTimers[timerId].seconds > 0;
	const nextStepAction = (isTimerRunning || isTimedExercise) ? 'window.nextStep()' : `window.toggleTimer('${window.activeDay}', ${exIndex}, '${exercise.rest}', true)`;
	let html = `<div class="bg-gray-800 p-6 mb-6 rounded-xl shadow-2xl border-4 border-blue-500/50"><div class="flex justify-between items-center mb-4 border-b border-gray-700 pb-3">
	<h3 class="text-2xl font-extrabold text-white">${exercise.name}</h3>${!isTimedExercise ? `<span class="text-2xl font-mono font-bold text-yellow-400 p-2 bg-gray-700 rounded-lg">${window.currentSet}/${exercise.sets}</span>` : ''}</div><div class="flex flex-col md:flex-row gap-6"><div class="flex-shrink-0 w-full md:w-1/2"><img src="${getImageUrl(exercise)}" alt="Immagine di ${exercise.name}" onerror="this.onerror=null; this.src='https://placehold.co/400x200/800080/ffffff/png?text=IMMAGINE+NON+DISPONIBILE';" class="w-full h-auto object-cover rounded-lg border border-gray-600 shadow-md aspect-[4/3]">
	${!isTimedExercise ? 
	  `<div class="mt-4 p-4 bg-gray-900 rounded-xl">
			<label for="${window.activeDay}-${exIndex}-${window.currentSet - 1}" class="text-sm font-semibold mb-2 block text-yellow-300">Peso per Serie ${window.currentSet} (Reps: ${exercise.reps})</label>
			<input type="number" step="0.5" value="${currentWeight}" onchange="window.saveWeight('${window.activeDay}', ${exIndex}, ${window.currentSet - 1}, this.value)" id="${window.activeDay}-${exIndex}-${window.currentSet - 1}" class="w-full p-3 text-2xl text-white bg-gray-700 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 text-center" placeholder="Peso (kg)">
			<!-- BOTTONE COMPATTO RECUPERO -->
			<button onclick="window.openRestModal('${exercise.rest}')" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition duration-150 flex justify-center items-center gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				Recupero: ${exercise.rest}
			</button>
		</div>`	  		
		: `<div class="mt-4 p-4 bg-gray-700 rounded-xl text-center"><p class="text-lg font-bold text-green-400">DURATA: ${exercise.reps}</p><button onclick="window.nextStep()" class="mt-4 px-4 py-2 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700 transition duration-150 shadow-lg">COMPLETATO (Passa al Prossimo)</button></div>`}</div><div class="flex-grow flex flex-col justify-start"><p class="text-base text-gray-300 mb-4">${isTimedExercise ? `Concentrati sul mantenimento del ritmo o dell'intensità per la durata di ${exercise.reps}.` : `Esegui la tua ${window.currentSet}a serie. Concentrati sulla forma per ${exercise.reps} ripetizioni.`}</p>
	<!-- Blocco MODIFICATO con bottone AI e Salta -->
	<div class="mb-6">
		<div class="flex flex-col sm:flex-row gap-2">
			<!-- NUOVO: Bottone Salta -->
			<button onclick="window.skipExercise()" class="w-full sm:w-1/2 px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition duration-150 shadow-md flex items-center justify-center">
				<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
				Salta per Ora
			</button>
			<!-- Bottone AI (ora occupa metà spazio su schermi medi) -->
			<button id="tip-btn-${window.activeDay}-${exIndex}" onclick="generateExerciseTip('${exercise.name}', document.getElementById('tip-output-${window.activeDay}-${exIndex}'))" class="w-full sm:w-1/2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition duration-150 shadow-md flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">✨ Consiglio AI</button>			
		</div>
		<!-- Output del consiglio AI -->
		<div id="tip-output-${window.activeDay}-${exIndex}" class="p-3 mt-2 bg-gray-900 rounded-lg text-gray-400 min-h-[50px] flex items-center"><span class="text-xs">${exercise.notes ? `Nota Predefinita: ${exercise.notes}` : 'Clicca per un consiglio sul corretto svolgimento.'}</span></div>
	</div>
	</div></div><div class="mt-6 border-t border-gray-700 pt-4"><label for="notes-guided-${exIndex}" class="font-bold mb-2 block text-sm text-white">Note Personali per l'Esercizio:</label><textarea id="notes-guided-${exIndex}" rows="1" placeholder="${exercise.notes || 'Aggiungi note personali su esecuzione, sensazioni... (Es. presa stretta, cedimento)'}" onchange="window.saveNote('${window.activeDay}', ${exIndex}, this.value)" class="w-full p-3 text-sm text-white bg-gray-700 border border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 shadow-inner">${(exercise.logged_notes && exercise.logged_notes.trim()) ? exercise.logged_notes : ''}</textarea></div></div>`;
	contentDiv.innerHTML = html;
	if (!isTimedExercise) { updateTimerDisplay(timerId, activeTimers[timerId] ? activeTimers[timerId].seconds : restSeconds, true); }
}		

function switchDay(newDayId) { /* ... codice invariato ... */
	if (window.isGuidedMode) { stopGuidedMode(); }
	if (window.activeDay === newDayId) return; window.activeDay = newDayId;
	calculateTotalTonnageForDay(newDayId); updateTonnageDisplay();
	renderDay(newDayId);
	if (window.isPersistenceEnabled) { startDataListener(newDayId); }
	document.querySelectorAll('.day-tab').forEach(tab => {
		if (tab.dataset.day === newDayId) { tab.classList.remove('text-gray-400', 'border-transparent'); tab.classList.add('text-white', 'border-blue-500', 'bg-gray-800'); } else { tab.classList.remove('text-white', 'border-blue-500', 'bg-gray-800'); tab.classList.add('text-gray-400', 'border-transparent'); }
	});
}
window.switchDay = switchDay;

function renderDay(dayId) { 
	const dayData = window.workoutDays[dayId]; const contentDiv = document.getElementById('workout-content');
	document.getElementById('mode-toggle-button').classList.remove('hidden'); document.getElementById('guided-controls-container').classList.add('hidden'); document.getElementById('day-tabs').classList.remove('hidden'); document.getElementById('total-timer').classList.add('hidden');
	if (!dayData) { contentDiv.innerHTML = '<p class="text-red-500">Giorno di allenamento non trovato.</p>'; return; }
	let titleHtml = `<h2 class="text-2xl font-bold mb-6 text-blue-400">${dayData.name}</h2>`;
	let cardsHtml = ''; // Nuova variabile per accumulare solo le card
	dayData.exercises.forEach((exercise, exIndex) => {
		const restSeconds = getRestTimeSeconds(exercise.rest); 
		const timerId = `timer-display-${dayId}-${exIndex}`; 
		const isTimedExercise = exercise.sets === 0 || exercise.rest === "N/A" || !exercise.sets;			
		// --- Costruiamo la card compatta ---
		cardsHtml += `<div class="horizontal-snap-child" data-index="${exIndex}">
			<div class="bg-gray-800 p-4 m-1 rounded-xl shadow-lg border border-gray-700">
				<div class="flex flex-col sm:flex-row gap-4">
	
				<!-- Immagine (dal tuo codice originale) -->
				<div class="flex-shrink-0 w-full sm:w-1/3">
					<img src="${getImageUrl(exercise)}" alt="Immagine di ${exercise.name}" onerror="this.onerror=null; this.src='https.placehold.co/400x200/800080/ffffff/png?text=LINK+NON+PUBBLICO!+Carica+un+link+diretto';" class="w-full h-auto object-cover rounded-lg border border-gray-600 shadow-md aspect-[4/3]">
				</div>
	
				<!-- Info Esercizio (dal tuo codice originale) -->
				<div class="flex-grow flex flex-col justify-center">
					<div>
						<h3 class="text-2xl font-bold mb-1 text-white">${exercise.name}</h3>
						<p class="text-sm text-gray-400">Numero Serie: <span class="text-blue-300 font-semibold">${exercise.sets}</span></p>
						<p class="text-sm text-gray-400">Ripetizioni/Durata: <span class="text-blue-300 font-semibold">${exercise.reps}</span></p>
					</div>
					${!isTimedExercise ? `<div class="mt-4"><p class="text-sm text-gray-400">Recupero Previsto: <span class="text-yellow-300 font-semibold">${exercise.rest}</span></p></div>` : `<p class="text-sm text-gray-400 mt-2 p-3 bg-gray-700 rounded-lg">Modalità: <span class="text-green-400 font-bold">Continuo / Durata (Non a Serie)</span></p>`}
	
					<!-- Aggiunta della Nota di Default (solo se esiste) -->
					${exercise.notes ? `
					<p class="text-xs text-gray-400 italic mt-3 pt-2 border-t border-gray-700">
						Nota: ${exercise.notes}
					</p>
					` : ''}
							</div>
						</div>
					</div>
				</div>`; // <-- Aggiunto /div di chiusura per horizontal-snap-child
	});
	// --- NUOVA AGGIUNTA: Genera i pallini ---
	let dotsHtml = '<div class="swiper-dots">';
	dayData.exercises.forEach((_, index) => {
		// Aggiungi 'active' solo al primo pallino (default)
		const isActive = (index === 0) ? 'active' : '';
		dotsHtml += `<div class="swiper-dot ${isActive}" data-dot-index="${index}"></div>`;
	});
	dotsHtml += '</div>';
	// Costruisce l'HTML finale avvolgendo le card e aggiungendo i pallini
	let finalHtml = titleHtml + 
					`<div class="horizontal-snap-container no-scrollbar -mx-1">
						${cardsHtml}
					</div>` +
					dotsHtml; // <-- AGGIUNTA DEI PALLINI
	
	contentDiv.innerHTML = finalHtml;
	// --- NUOVA AGGIUNTA: Avvia l'observer ---
	// Deve essere chiamato DOPO aver scritto l'innerHTML
	window.initSwiperObserver();
}

document.addEventListener('DOMContentLoaded', () => {
	const tabsContainer = document.getElementById('day-tabs');
	let tabsHtml = '';
	let isFirst = true;
	for (const [dayId, data] of Object.entries(window.workoutDays)) {
		const activeClasses = isFirst ? 'text-white border-blue-500 bg-gray-800' : 'text-gray-400 border-transparent';
		tabsHtml += `<button class="day-tab flex-1 py-3 text-base font-semibold border-b-2 ${activeClasses} transition duration-300 hover:border-blue-500 hover:text-white hover:bg-gray-800/70" data-day="${dayId}" onclick="window.switchDay('${dayId}')">${data.name.split(':')[0]}</button>`;
		isFirst = false;
	}
	tabsContainer.innerHTML = tabsHtml;
	// --- NUOVA AGGIUNTA: REGISTRAZIONE SERVICE WORKER ---
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('sw.js')
			.then(registration => {
				console.log('Service Worker registrato con successo:', registration);
			})
			.catch(error => {
				console.error('Registrazione Service Worker fallita:', error);
			});
	}
	// --- FINE AGGIUNTA ---
	initializeFirebase();
});

// --- GESTIONE SESSIONE ATTIVA (PERSISTENZA TEMPORANEA) ---

/**
 * Salva lo stato corrente dell'allenamento in un documento dedicato.
 * Viene chiamato ogni volta che lo stato cambia (nextStep, saveWeight, ecc.)
 */
async function saveActiveSession() {
    if (!window.userId || !window.isGuidedMode || !window.isPersistenceEnabled) return;

    try {
        const docRef = doc(window.db, `artifacts/${window.appId}/users/${window.userId}/active_session`, 'current');
        
        const sessionData = {
            dayId: window.activeDay,
            // Salviamo l'intera struttura del giorno perché l'ordine degli esercizi potrebbe essere cambiato (skipExercise)
            dayData: window.workoutDays[window.activeDay],
            currentExIndex: window.currentExIndex,
            currentSet: window.currentSet,
            totalTonnage: window.totalTonnage,
            totalTimeSeconds: window.totalTimeSeconds,
            exerciseTonnageMap: window.exerciseTonnageMap,
            timestamp: new Date().toISOString()
        };

        // Salvataggio "fire and forget" (non aspettiamo l'await per non bloccare la UI)
        setDoc(docRef, sessionData).catch(e => console.error("Errore salvataggio sessione background:", e));
        
    } catch (error) {
        console.error("Errore nella preparazione del salvataggio sessione:", error);
    }
}

/**
 * Cancella la sessione attiva (quando l'allenamento è finito o interrotto volontariamente).
 */
async function clearActiveSession() {
    if (!window.userId || !window.isPersistenceEnabled) return;
    const docRef = doc(window.db, `artifacts/${window.appId}/users/${window.userId}/active_session`, 'current');
    try {
        await deleteDoc(docRef);
    } catch (e) {
        console.error("Errore cancellazione sessione:", e);
    }
}

/**
 * Controlla se esiste una sessione interrotta e la ripristina.
 */
async function checkAndRestoreSession() {
    if (!window.userId || !window.isPersistenceEnabled) return;
    
    const docRef = doc(window.db, `artifacts/${window.appId}/users/${window.userId}/active_session`, 'current');
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Chiediamo conferma? Per ora facciamo ripristino automatico per semplicità e immediatezza
            console.log("Trovata sessione attiva, ripristino in corso...");
            
            // 1. Ripristina variabili
            window.activeDay = data.dayId;
            window.workoutDays[data.dayId] = data.dayData; // Ripristina ordine esercizi e note/pesi
            window.currentExIndex = data.currentExIndex;
            window.currentSet = data.currentSet;
            window.totalTonnage = data.totalTonnage;
            window.totalTimeSeconds = data.totalTimeSeconds;
            window.exerciseTonnageMap = data.exerciseTonnageMap || {};
            
            // 2. Avvia modalità guidata (in modalità "resume")
            startGuidedMode(true); 
            
            showTemporaryMessage('Sessione precedente recuperata!', 'bg-blue-600');
        }
    } catch (error) {
        console.error("Errore nel ripristino della sessione:", error);
    }
}

// --- TOOL DI MIGRAZIONE MANUALE ---

/**
 * Copia tutto lo storico da un vecchio user ID all'utente attualmente loggato.
 * Da usare una volta sola per recuperare i dati persi.
 */
async function migrateFromOldUser(oldUserId) {
    if (!oldUserId) {
        alert("Devi specificare il vecchio ID!");
        return;
    }
    if (!window.userId) {
        alert("Devi essere loggato col nuovo utente per ricevere i dati.");
        return;
    }
    
    if (!confirm(`Sei sicuro di voler copiare lo storico da ${oldUserId} all'utente corrente?`)) return;

    showTemporaryMessage('Inizio migrazione dati...', 'bg-yellow-600');
    
    try {
        // 1. Riferimento alla vecchia collezione
        const oldHistoryRef = collection(window.db, `artifacts/${window.appId}/users/${oldUserId}/workout_history`);
        
        // 2. Riferimento alla nuova collezione (Utente attuale)
        const newHistoryRef = collection(window.db, `artifacts/${window.appId}/users/${window.userId}/workout_history`);
        
        // 3. Leggi i vecchi dati
        const snapshot = await getDocs(oldHistoryRef);
        
        if (snapshot.empty) {
            showTemporaryMessage('Nessun dato trovato nel vecchio ID.', 'bg-red-500');
            return;
        }
        
        let count = 0;
        const promises = [];
        
        // 4. Copia ogni documento
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Aggiungiamo al nuovo utente (addDoc genera un nuovo ID univoco)
            promises.push(addDoc(newHistoryRef, data));
            count++;
        });
        
        // Aspetta che tutte le copie siano finite
        await Promise.all(promises);
        
        showTemporaryMessage(`Successo! Recuperati ${count} allenamenti.`, 'bg-green-600');
        
        // Ricarica la vista per mostrare i nuovi dati
        loadAndRenderHistory();
        
    } catch (err) {
        console.error("Errore migrazione:", err);
        showTemporaryMessage('Errore durante la migrazione. Controlla la console.', 'bg-red-500');
    }
}
window.migrateFromOldUser = migrateFromOldUser;
