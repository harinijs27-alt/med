console.log("SCRIPT.JS LOADED");

// ============================================================
// SMART IV FLUID MONITORING SYSTEM
// ESP32 + Web Serial + Nurse Beacon + Laptop Alert
// ============================================================


// ============================================================
// CLOCK
// ============================================================

function updateClock() {

    const now = new Date();

    const timeElement =
        document.getElementById("time");

    const dateElement =
        document.getElementById("date");


    if (timeElement) {

        timeElement.innerHTML =
            now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
            });
    }


    if (dateElement) {

        dateElement.innerHTML =
            now.toDateString();
    }
}


setInterval(updateClock, 1000);

updateClock();


// ============================================================
// INITIAL VALUES
// ============================================================

let ivLevel = 100;

let weight = 0;

let remaining = 0;

let eta = 0;

let heartRate = 0;

let spo2 = 0;


// ============================================================
// NURSE / BEACON
// ============================================================

let nursePresent = false;

let nurseRSSI = -100;

let nurseDistance = null;


// IMPORTANT:
//
// Nurse is considered PRESENT only when
// estimated distance is <= 1 meter.
//

const NURSE_RANGE_METERS = 1;


// Beacon calibration.
//
// -59 is a common starting reference.
// You may need to adjust this according
// to your actual beacon.
//

const BEACON_REFERENCE_RSSI = -59;


// ============================================================
// IV EMERGENCY
// ============================================================

let bottleRemoved = false;

let timerStarted = false;

let countdown = 30;

let countdownInterval = null;


// ============================================================
// NURSE CHECK
// ============================================================

let nextNurseCheck = 45;

let nurseCheckInterval = null;


// ============================================================
// SERIAL VARIABLES
// ============================================================

let serialPort = null;

let serialReader = null;

let serialConnected = false;


// ============================================================
// LAPTOP AUDIO VARIABLES
// ============================================================

let audioContext = null;

let alertSoundInterval = null;


// ============================================================
// HTML ELEMENTS
// ============================================================

const progress =
    document.getElementById("ivProgress");


const liquid =
    document.getElementById("liquid");


const ivText =
    document.getElementById("ivText");


const weightText =
    document.getElementById("weight");


const remainingText =
    document.getElementById("remaining");


const etaText =
    document.getElementById("timeLeft");


const statusBadge =
    document.getElementById("statusBadge");


const notificationList =
    document.getElementById("notificationList");


const heartRateText =
    document.getElementById("heartRate");


const spo2Text =
    document.getElementById("spo2");


const ivPercent =
    document.getElementById("ivPercent");


const weightCard =
    document.getElementById("weightCard");


const etaCard =
    document.getElementById("eta");


const acknowledgeButton =
    document.querySelector(".ack-btn");


const connectButton =
    document.getElementById("connectESP32");


// ============================================================
// NURSE HTML ELEMENTS
// ============================================================

const nurseStatusText =
    document.getElementById("nurseStatus");


const nurseRangeText =
    document.getElementById("nurseRange");


const beaconDistanceText =
    document.getElementById("beaconDistance");


const nextNurseCheckText =
    document.getElementById("nextNurseCheck");


const nurseBeaconStatus =
    document.getElementById("nurseBeaconStatus");


const nurseRSSIStatus =
    document.getElementById("nurseRSSIStatus");


// ============================================================
// CALCULATE IV LEVEL
// ============================================================

function calculateIVLevel(weightValue) {

    const FULL_WEIGHT = 500;

    let level =
        (weightValue / FULL_WEIGHT) * 100;


    level =
        Math.max(
            0,
            Math.min(
                100,
                level
            )
        );


    return Math.round(level);
}


// ============================================================
// CALCULATE BEACON DISTANCE
// ============================================================

function calculateBeaconDistance(rssi) {

    if (
        typeof rssi !== "number" ||
        rssi >= 0
    ) {

        return null;
    }


    /*
        Approximate BLE distance.

        RSSI becomes weaker as the beacon
        moves farther away.

        This is an ESTIMATE, not an exact
        physical distance measurement.
    */


    const distance =
        Math.pow(
            10,
            (BEACON_REFERENCE_RSSI - rssi) / 20
        );


    return Math.max(
        0.1,
        Math.min(
            50,
            distance
        )
    );
}


// ============================================================
// DETERMINE NURSE PRESENCE FROM DISTANCE
// ============================================================

function determineNursePresence() {

    const distance =
        calculateBeaconDistance(nurseRSSI);


    nurseDistance =
        distance;


    if (distance === null) {

        nursePresent = false;

        return;
    }


    /*
        IMPORTANT:

        Nurse PRESENT:
        distance <= 1 meter

        Nurse NOT PRESENT:
        distance > 1 meter
    */

    if (
        distance <=
        NURSE_RANGE_METERS
    ) {

        nursePresent = true;

    }
    else {

        nursePresent = false;
    }
}


// ============================================================
// UPDATE NURSE MONITORING
// ============================================================

function updateNurseMonitoring() {

    determineNursePresence();


    // ========================================================
    // NURSE PRESENT
    // ========================================================

    if (nursePresent) {

        if (nurseStatusText) {

            nurseStatusText.innerHTML =
                "👩‍⚕️ Nurse Present";

            nurseStatusText.className =
                "nurse-present";
        }


        if (nurseRangeText) {

            nurseRangeText.innerHTML =
                "🟢 Within 1 m Range";

            nurseRangeText.className =
                "beacon-good";
        }


        if (beaconDistanceText) {

            beaconDistanceText.innerHTML =
                nurseDistance.toFixed(2) +
                " m";
        }


        if (nurseBeaconStatus) {

            nurseBeaconStatus.innerHTML =
                "📡 Nurse Beacon : PRESENT";
        }


        if (nurseRSSIStatus) {

            nurseRSSIStatus.innerHTML =
                "📶 Nurse Signal : " +
                nurseRSSI +
                " dBm";
        }

    }


    // ========================================================
    // NURSE NOT PRESENT
    // ========================================================

    else {

        if (nurseStatusText) {

            nurseStatusText.innerHTML =
                "⚪ Nurse Not Detected";

            nurseStatusText.className =
                "nurse-absent";
        }


        if (nurseRangeText) {

            nurseRangeText.innerHTML =
                "🔴 Outside 1 m Range";

            nurseRangeText.className =
                "beacon-weak";
        }


        if (beaconDistanceText) {

            if (nurseDistance !== null) {

                beaconDistanceText.innerHTML =
                    nurseDistance.toFixed(2) +
                    " m";

            }
            else {

                beaconDistanceText.innerHTML =
                    "--";
            }
        }


        if (nurseBeaconStatus) {

            nurseBeaconStatus.innerHTML =
                "📡 Nurse Beacon : NOT PRESENT";
        }


        if (nurseRSSIStatus) {

            nurseRSSIStatus.innerHTML =
                "📶 Nurse Signal : " +
                nurseRSSI +
                " dBm";
        }
    }


    // ========================================================
    // NEXT NURSE CHECK
    // ========================================================

    if (nextNurseCheckText) {

        nextNurseCheckText.innerHTML =
            nextNurseCheck +
            " Min";
    }
}


// ============================================================
// NURSE CHECK TIMER
// ============================================================

function startNurseCheckTimer() {

    if (nurseCheckInterval) {

        clearInterval(
            nurseCheckInterval
        );
    }


    nextNurseCheck = 45;


    nurseCheckInterval =
        setInterval(() => {

            nextNurseCheck--;


            if (
                nextNurseCheck <= 0
            ) {

                nextNurseCheck = 45;


                addNotification(
                    "👩‍⚕️ Nurse check interval reached"
                );
            }


            if (nextNurseCheckText) {

                nextNurseCheckText.innerHTML =
                    nextNurseCheck +
                    " Min";
            }

        }, 60000);
}


// ============================================================
// LAPTOP AUDIO INITIALIZATION
// ============================================================

function initializeLaptopAudio() {

    try {

        if (!audioContext) {

            audioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();
        }


        if (
            audioContext.state ===
            "suspended"
        ) {

            audioContext.resume();
        }


        console.log(
            "🔊 Laptop audio initialized"
        );

    }
    catch (error) {

        console.error(
            "❌ Laptop audio initialization failed:",
            error
        );
    }
}


// ============================================================
// PLAY ONE EMERGENCY BEEP
// ============================================================

function playEmergencyBeep() {

    if (!audioContext) {

        initializeLaptopAudio();
    }


    if (!audioContext) {

        return;
    }


    try {

        const oscillator =
            audioContext.createOscillator();


        const gain =
            audioContext.createGain();


        // Emergency tone

        oscillator.type =
            "square";


        oscillator.frequency.setValueAtTime(
            900,
            audioContext.currentTime
        );


        // Volume

        gain.gain.setValueAtTime(
            0.001,
            audioContext.currentTime
        );


        gain.gain.exponentialRampToValueAtTime(
            0.5,
            audioContext.currentTime + 0.02
        );


        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + 0.45
        );


        oscillator.connect(gain);

        gain.connect(
            audioContext.destination
        );


        oscillator.start();


        oscillator.stop(
            audioContext.currentTime + 0.5
        );


        console.log(
            "🔊 LAPTOP ALERT BEEP"
        );

    }
    catch (error) {

        console.error(
            "❌ Alert beep error:",
            error
        );
    }
}


// ============================================================
// START LAPTOP ALERT SOUND
// ============================================================

function startAlertSound() {

    console.log(
        "🚨 STARTING LAPTOP EMERGENCY SOUND"
    );


    initializeLaptopAudio();


    if (alertSoundInterval) {

        return;
    }


    // Immediate beep

    playEmergencyBeep();


    // Repeat every second

    alertSoundInterval =
        setInterval(() => {

            playEmergencyBeep();

        }, 1000);
}


// ============================================================
// STOP LAPTOP ALERT SOUND
// ============================================================

function stopAlertSound() {

    if (alertSoundInterval) {

        clearInterval(
            alertSoundInterval
        );

        alertSoundInterval = null;
    }


    console.log(
        "🔇 LAPTOP ALERT SOUND STOPPED"
    );
}


// ============================================================
// NOTIFICATIONS
// ============================================================

function addNotification(message) {

    if (!notificationList) {

        return;
    }


    const li =
        document.createElement("li");


    li.innerHTML =
        message;


    notificationList.prepend(li);


    // Keep only latest 10

    while (
        notificationList.children.length >
        10
    ) {

        notificationList.removeChild(
            notificationList.lastChild
        );
    }
}


// ============================================================
// BOTTLE REMOVED
// ============================================================

function handleBottleRemoved() {

    // Prevent repeated triggering

    if (bottleRemoved) {

        return;
    }


    bottleRemoved = true;


    console.log(
        "🚨 IV BOTTLE REMOVED"
    );


    addNotification(
        "🚨 IV Bottle Removed!"
    );


    addNotification(
        "🔊 Laptop Emergency Alert Activated"
    );


    addNotification(
        "💡 Safety Alert Triggered"
    );


    addNotification(
        "📡 Nurse Station Notified"
    );


    // START LAPTOP SOUND

    startAlertSound();


    // START 30 SECOND COUNTDOWN

    if (!timerStarted) {

        timerStarted = true;

        startCountdown();
    }
}


// ============================================================
// BOTTLE DETECTED AGAIN
// ============================================================

function handleBottleDetected() {

    if (!bottleRemoved) {

        return;
    }


    bottleRemoved = false;


    console.log(
        "🟢 IV BOTTLE DETECTED AGAIN"
    );


    stopAlertSound();


    addNotification(
        "🟢 IV Bottle Detected Again"
    );


    addNotification(
        "🔇 Emergency Alert Cleared"
    );


    // Stop countdown

    if (countdownInterval) {

        clearInterval(
            countdownInterval
        );

        countdownInterval = null;
    }


    timerStarted = false;
}


// ============================================================
// UPDATE DASHBOARD
// ============================================================

function updateDashboard() {

    // ========================================================
    // NURSE
    // ========================================================

    updateNurseMonitoring();


    // ========================================================
    // IV PROGRESS BAR
    // ========================================================

    if (progress) {

        progress.value =
            ivLevel;
    }


    // ========================================================
    // IV BOTTLE
    // ========================================================

    if (liquid) {

        liquid.style.height =
            Math.max(
                0,
                Math.min(
                    100,
                    ivLevel
                )
            ) + "%";
    }


    // ========================================================
    // IV TEXT
    // ========================================================

    if (ivText) {

        ivText.innerHTML =
            "IV Level : " +
            ivLevel +
            "%";
    }


    // ========================================================
    // WEIGHT
    // ========================================================

    if (weightText) {

        weightText.innerHTML =
            Number(weight).toFixed(1) +
            " g";
    }


    if (weightCard) {

        weightCard.innerHTML =
            Number(weight).toFixed(1) +
            " g";
    }


    // ========================================================
    // REMAINING
    // ========================================================

    if (remainingText) {

        remainingText.innerHTML =
            Math.max(
                0,
                Number(remaining)
            ).toFixed(0) +
            " mL";
    }


    // ========================================================
    // ETA
    // ========================================================

    if (etaText) {

        etaText.innerHTML =
            Math.max(
                0,
                Number(eta)
            ).toFixed(0) +
            " Minutes";
    }


    if (etaCard) {

        etaCard.innerHTML =
            Math.max(
                0,
                Number(eta)
            ).toFixed(0) +
            " Min";
    }


    // ========================================================
    // IV PERCENTAGE
    // ========================================================

    if (ivPercent) {

        ivPercent.innerHTML =
            ivLevel +
            "%";
    }


    // ========================================================
    // HEART RATE
    // ========================================================

    if (heartRateText) {

        if (heartRate > 0) {

            heartRateText.innerHTML =
                heartRate;

        }
        else {

            heartRateText.innerHTML =
                "--";
        }
    }


    // ========================================================
    // SpO2
    // ========================================================

    if (spo2Text) {

        if (spo2 > 0) {

            spo2Text.innerHTML =
                spo2 +
                "%";

        }
        else {

            spo2Text.innerHTML =
                "--";
        }
    }


    // ========================================================
    // IV STATUS
    // ========================================================

    if (!statusBadge) {

        return;
    }


    // ========================================================
    // NO BOTTLE
    // ========================================================

    if (weight <= 10) {

        statusBadge.innerHTML =
            "🔴 Bottle Removed";


        statusBadge.style.background =
            "#FEE2E2";


        statusBadge.style.color =
            "#b91c1c";


        return;
    }


    // ========================================================
    // NORMAL
    // ========================================================

    if (ivLevel > 50) {

        statusBadge.innerHTML =
            "🟢 Normal";


        statusBadge.style.background =
            "#d1fae5";


        statusBadge.style.color =
            "#047857";
    }


    // ========================================================
    // LOW
    // ========================================================

    else if (ivLevel > 20) {

        statusBadge.innerHTML =
            "🟡 Low";


        statusBadge.style.background =
            "#FEF3C7";


        statusBadge.style.color =
            "#92400e";
    }


    // ========================================================
    // CRITICAL
    // ========================================================

    else {

        statusBadge.innerHTML =
            "🔴 Critical";


        statusBadge.style.background =
            "#FEE2E2";


        statusBadge.style.color =
            "#b91c1c";
    }
}


// ============================================================
// SERVO COUNTDOWN
// ============================================================

function startCountdown() {

    addNotification(
        "🔴 Emergency condition detected"
    );


    addNotification(
        "💡 LED Turned ON"
    );


    addNotification(
        "📡 Nurse Station Notified"
    );


    countdown = 30;


    if (countdownInterval) {

        clearInterval(
            countdownInterval
        );
    }


    countdownInterval =
        setInterval(() => {

            countdown--;


            addNotification(
                "⏳ Servo activates in " +
                countdown +
                " sec"
            );


            if (countdown <= 0) {

                clearInterval(
                    countdownInterval
                );


                countdownInterval =
                    null;


                addNotification(
                    "⚠ Servo Activated"
                );


                addNotification(
                    "🚫 IV Line Closed"
                );


                // Keep laptop alert running
                // until nurse acknowledges.

            }

        }, 1000);
}


// ============================================================
// ACKNOWLEDGE BUTTON
// ============================================================

if (acknowledgeButton) {

    acknowledgeButton.addEventListener(
        "click",
        () => {

            console.log(
                "✅ ACKNOWLEDGE BUTTON CLICKED"
            );


            // STOP LAPTOP SOUND

            stopAlertSound();


            // STOP COUNTDOWN

            if (countdownInterval) {

                clearInterval(
                    countdownInterval
                );

                countdownInterval = null;
            }


            addNotification(
                "✅ Nurse Acknowledged Alert"
            );


            addNotification(
                "🟢 Servo Cancelled"
            );


            addNotification(
                "🔇 Laptop Emergency Sound Stopped"
            );


            timerStarted = false;
        }
    );
}


// ============================================================
// CONNECT ESP32
// ============================================================

async function connectESP32() {

    console.log(
        "🔌 Connect ESP32 button clicked"
    );


    // IMPORTANT:
    // This user interaction unlocks
    // laptop audio in Chrome.

    initializeLaptopAudio();


    // ========================================================
    // CHECK WEB SERIAL
    // ========================================================

    if (!("serial" in navigator)) {

        alert(
            "Web Serial is not supported.\n\n" +
            "Please use Google Chrome or Microsoft Edge."
        );


        return;
    }


    try {

        // ====================================================
        // REQUEST COM PORT
        // ====================================================

        serialPort =
            await navigator.serial.requestPort();


        console.log(
            "ESP32 port selected"
        );


        // ====================================================
        // OPEN SERIAL PORT
        // ====================================================

        await serialPort.open({
            baudRate: 115200
        });


        serialConnected = true;


        // ====================================================
        // CHANGE BUTTON
        // ====================================================

        if (connectButton) {

            connectButton.innerHTML =
                "🟢 ESP32 Connected";


            connectButton.style.background =
                "#16a34a";
        }


        addNotification(
            "🟢 ESP32 Connected Successfully"
        );


        console.log(
            "ESP32 connected successfully"
        );


        // ====================================================
        // START NURSE CHECK TIMER
        // ====================================================

        startNurseCheckTimer();


        // ====================================================
        // START READING SERIAL
        // ====================================================

        readSerialData();

    }
    catch (error) {

        console.error(
            "ESP32 connection error:",
            error
        );


        serialConnected = false;


        addNotification(
            "🔴 ESP32 Connection Failed"
        );


        alert(
            "ESP32 connection failed.\n\n" +
            "Make sure Arduino Serial Monitor is CLOSED " +
            "and try again."
        );
    }
}


// ============================================================
// READ SERIAL DATA
// ============================================================

async function readSerialData() {

    if (!serialPort) {

        return;
    }


    const decoder =
        new TextDecoder();


    serialReader =
        serialPort.readable.getReader();


    let buffer = "";


    try {

        while (true) {

            const {
                value,
                done
            } =
                await serialReader.read();


            if (done) {

                break;
            }


            if (value) {

                buffer +=
                    decoder.decode(
                        value,
                        {
                            stream: true
                        }
                    );


                const lines =
                    buffer.split(/\r?\n/);


                buffer =
                    lines.pop();


                for (
                    const line of lines
                ) {

                    processESP32Data(
                        line.trim()
                    );
                }
            }
        }
    }


    catch (error) {

        console.error(
            "Serial reading error:",
            error
        );
    }


    finally {

        if (serialReader) {

            try {

                serialReader.releaseLock();

            }
            catch (e) {

                console.log(e);
            }
        }
    }
}


// ============================================================
// PROCESS ESP32 JSON
// ============================================================

function processESP32Data(line) {

    if (!line) {

        return;
    }


    console.log(
        "ESP32 DATA:",
        line
    );


    // ========================================================
    // IGNORE NORMAL SERIAL MESSAGES
    // ========================================================

    if (
        !line.startsWith("{")
    ) {

        return;
    }


    try {

        const data =
            JSON.parse(line);


        console.log(
            "JSON RECEIVED:",
            data
        );


        // ====================================================
        // WEIGHT
        // ====================================================

        if (
            typeof data.weight ===
            "number"
        ) {

            const previousWeight =
                weight;


            weight =
                data.weight;


            remaining =
                Math.max(
                    0,
                    data.weight
                );


            // ==================================================
            // BOTTLE DETECTION
            // ==================================================

            /*
                If weight is <= 10g,
                assume IV bottle has been removed.

                If your ESP32 gives a different
                value when removed, change 10.
            */

            if (
                weight <= 10 &&
                previousWeight > 10
            ) {

                handleBottleRemoved();
            }


            else if (
                weight > 10 &&
                previousWeight <= 10
            ) {

                handleBottleDetected();
            }
        }


        // ====================================================
        // IV LEVEL
        // ====================================================

        if (
            typeof data.ivLevel ===
            "number"
        ) {

            ivLevel =
                Math.max(
                    0,
                    Math.min(
                        100,
                        Math.round(
                            data.ivLevel
                        )
                    )
                );
        }


        // ====================================================
        // FALLBACK IV LEVEL
        // ====================================================

        else if (
            typeof data.weight ===
            "number"
        ) {

            ivLevel =
                calculateIVLevel(
                    data.weight
                );
        }


        // ====================================================
        // HEART RATE
        // ====================================================

        if (
            typeof data.heartRate ===
            "number"
        ) {

            heartRate =
                data.heartRate;
        }


        // ====================================================
        // SpO2
        // ====================================================

        if (
            typeof data.spo2 ===
            "number"
        ) {

            spo2 =
                data.spo2;
        }


        // ====================================================
        // NURSE RSSI
        // ====================================================

        if (
            typeof data.nurseRSSI ===
            "number"
        ) {

            const previousNurse =
                nursePresent;


            nurseRSSI =
                data.nurseRSSI;


            // Determine presence ONLY
            // from RSSI-derived distance.

            determineNursePresence();


            // ==================================================
            // NURSE JUST ARRIVED
            // ==================================================

            if (
                nursePresent &&
                !previousNurse
            ) {

                addNotification(
                    "👩‍⚕️ Nurse Present - Beacon within 1 m"
                );
            }


            // ==================================================
            // NURSE LEFT
            // ==================================================

            if (
                !nursePresent &&
                previousNurse
            ) {

                addNotification(
                    "⚠ Nurse Beacon Outside 1 m Range"
                );
            }
        }


        // ====================================================
        // OPTIONAL ESP32 nursePresent
        // ====================================================

        /*
            We intentionally DO NOT directly trust
            data.nursePresent.

            The dashboard determines nurse presence
            from the beacon RSSI and 1-meter range.

            This prevents the ESP32's boolean value
            from incorrectly showing "Present".
        */


        // ====================================================
        // ETA
        // ====================================================

        /*
            Current flow rate:
            25 mL/hour
        */

        const FLOW_RATE =
            25;


        if (remaining > 0) {

            eta =
                remaining /
                FLOW_RATE;
        }

        else {

            eta = 0;
        }


        // ====================================================
        // UPDATE DASHBOARD
        // ====================================================

        updateDashboard();


        // ====================================================
        // SERIAL DEBUG
        // ====================================================

        console.log(
            "--------------------------------"
        );


        console.log(
            "IV Weight:",
            weight,
            "g"
        );


        console.log(
            "IV Level:",
            ivLevel,
            "%"
        );


        console.log(
            "Heart Rate:",
            heartRate,
            "BPM"
        );


        console.log(
            "SpO2:",
            spo2,
            "%"
        );


        console.log(
            "Nurse RSSI:",
            nurseRSSI,
            "dBm"
        );


        console.log(
            "Nurse Distance:",
            nurseDistance !== null
                ? nurseDistance.toFixed(2) + " m"
                : "--"
        );


        console.log(
            "Nurse Present:",
            nursePresent
        );


        console.log(
            "--------------------------------"
        );
    }


    catch (error) {

        console.log(
            "Invalid JSON:",
            line
        );


        console.error(
            error
        );
    }
}


// ============================================================
// CONNECT BUTTON EVENT
// ============================================================

if (connectButton) {

    console.log(
        "CONNECT BUTTON FOUND"
    );


    connectButton.addEventListener(
        "click",
        connectESP32
    );

}
else {

    console.error(
        "❌ CONNECT BUTTON NOT FOUND"
    );
}


// ============================================================
// INITIAL DASHBOARD
// ============================================================

updateDashboard();


// ============================================================
// INITIAL NOTIFICATIONS
// ============================================================

addNotification(
    "🟢 Dashboard Started"
);


addNotification(
    "🔌 Waiting for ESP32 Connection"
);


addNotification(
    "📡 Waiting for Nurse Beacon"
);


addNotification(
    "🔊 Laptop Alert System Ready"
);


// ============================================================
// INITIAL NURSE CHECK
// ============================================================

startNurseCheckTimer();


// ============================================================
// READY
// ============================================================

console.log(
    "========================================"
);

console.log(
    "SMART IV DASHBOARD READY"
);

console.log(
    "Laptop Alert Sound: READY"
);

console.log(
    "Nurse Beacon: READY"
);

console.log(
    "Nurse Range: 1 meter"
);

console.log(
    "ESP32 Web Serial: READY"
);

console.log(
    "========================================"
);
