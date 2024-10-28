const socket = io();
const remoteAudios = document.getElementById("remoteAudios");
const peerConnections = {};
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get("room");
const username = urlParams.get("username");

document.getElementById("roomCode").innerText = room;

let isMuted = false;
let isDeafened = false;
let localAudioTrack;

navigator.mediaDevices
  .getUserMedia({ audio: true })
  .then((stream) => {
    // إرسال الصوت للسيرفر والانضمام للغرفة
    socket.emit("joinRoom", { room, username });

    // إضافة مسار الصوت المحلي
    localAudioTrack = stream.getAudioTracks()[0];
    localAudioTrack.enabled = true; // اجعل الصوت مفعلاً

    socket.on("userJoined", (userId) => {
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }, // إضافة سيرفر STUN
        ],
      });

      // إضافة التعامل مع ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", {
            candidate: event.candidate,
            to: userId,
          });
        }
      };

      // إضافة تدفقات الصوت
      stream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, stream));

      peerConnection.ontrack = (event) => {
        const remoteAudio = document.createElement("audio");
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true; // التشغيل التلقائي
        remoteAudio.style.display = "none"; // إخفاء عنصر الصوت
        remoteAudios.appendChild(remoteAudio);

        // معالجة الخطأ في تشغيل الصوت
        remoteAudio.onerror = (error) => {
          console.error("Error playing remote audio:", error);
          alert(
            "Error playing remote audio. Please check your audio settings.",
          );
        };
      };

      peerConnections[userId] = peerConnection;

      peerConnection
        .createOffer()
        .then((offer) => {
          return peerConnection.setLocalDescription(offer).then(() => {
            socket.emit("offer", { offer, to: userId });
          });
        })
        .catch((err) => console.error("Error creating or sending offer:", err));
    });

    socket.on("offer", ({ offer, from }) => {
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }, // إضافة سيرفر STUN
        ],
      });

      // إضافة التعامل مع ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", { candidate: event.candidate, to: from });
        }
      };

      // إضافة تدفقات الصوت
      stream
        .getTracks()
        .forEach((track) => peerConnection.addTrack(track, stream));

      peerConnection.ontrack = (event) => {
        const remoteAudio = document.createElement("audio");
        remoteAudio.srcObject = event.streams[0];
        remoteAudio.autoplay = true; // التشغيل التلقائي
        remoteAudio.style.display = "none"; // إخفاء عنصر الصوت
        remoteAudios.appendChild(remoteAudio);

        // معالجة الخطأ في تشغيل الصوت
        remoteAudio.onerror = (error) => {
          console.error("Error playing remote audio:", error);
          alert(
            "Error playing remote audio. Please check your audio settings.",
          );
        };
      };

      peerConnection
        .setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => peerConnection.createAnswer())
        .then((answer) => {
          return peerConnection.setLocalDescription(answer).then(() => {
            socket.emit("answer", { answer, to: from });
          });
        })
        .catch((err) => console.error("Error handling offer:", err));

      peerConnections[from] = peerConnection;
    });

    socket.on("answer", ({ answer, from }) => {
      const peerConnection = peerConnections[from];
      if (peerConnection) {
        peerConnection
          .setRemoteDescription(new RTCSessionDescription(answer))
          .catch((err) => {
            console.error("Error setting remote description:", err);
          });
      }
    });

    socket.on("iceCandidate", ({ candidate, from }) => {
      const peerConnection = peerConnections[from];
      if (peerConnection) {
        peerConnection
          .addIceCandidate(new RTCIceCandidate(candidate))
          .catch((err) => {
            console.error("Error adding received ice candidate:", err);
          });
      }
    });
  })
  .catch((err) => console.error("Error accessing media devices:", err));

// توجيه الميوت
function toggleMute() {
  const muteButton = document.getElementById("muteButton");
  const muteIcon = document.getElementById("muteIcon");

  isMuted = !isMuted;

  if (isMuted) {
    localAudioTrack.enabled = false; // تعطيل الصوت
    muteIcon.classList.replace("fa-microphone", "fa-microphone-slash");
    muteButton.classList.add("active");
    muteButton.innerHTML =
      '<i id="muteIcon" class="fas fa-microphone-slash"></i> Unmute';
  } else {
    localAudioTrack.enabled = true; // تفعيل الصوت
    muteIcon.classList.replace("fa-microphone-slash", "fa-microphone");
    muteButton.classList.remove("active");
    muteButton.innerHTML =
      '<i id="muteIcon" class="fas fa-microphone"></i> Mute';
  }

  // Animation when toggling mute/unmute
  muteButton.classList.toggle("unmuted", !isMuted);
}

// توجيه الديفن
function toggleDeafen() {
  const deafenButton = document.getElementById("deafenButton");
  const deafenIcon = document.getElementById("deafenIcon");

  isDeafened = !isDeafened;

  // الحصول على جميع عناصر الصوت الخاصة بالمستخدمين الآخرين
  const remoteAudios = document.querySelectorAll("#remoteAudios audio");

  if (isDeafened) {
    // تعطيل تشغيل الصوت لجميع المستخدمين الآخرين
    remoteAudios.forEach((audio) => (audio.muted = true));
    deafenIcon.classList.replace("fa-headphones", "fa-headphones-alt");
    deafenButton.classList.add("active");
    deafenButton.innerHTML =
      '<i id="deafenIcon" class="fas fa-headphones-alt"></i> Undeafen';
  } else {
    // تفعيل تشغيل الصوت لجميع المستخدمين الآخرين
    remoteAudios.forEach((audio) => (audio.muted = false));
    deafenIcon.classList.replace("fa-headphones-alt", "fa-headphones");
    deafenButton.classList.remove("active");
    deafenButton.innerHTML =
      '<i id="deafenIcon" class="fas fa-headphones"></i> Deafen';
  }

  // Animation when toggling deafen/undeafen
  deafenButton.classList.toggle("undeafened", !isDeafened);
}

// إرسال الرسالة بالضغط على Enter
document
  .getElementById("messageInput")
  .addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
      sendMessage(); // استدعاء دالة إرسال الرسالة عند الضغط على Enter
    }
  });

function sendMessage() {
  const messageInput = document.getElementById("messageInput");
  const message = messageInput.value;
  if (message) {
    socket.emit("chatMessage", { message, username });
    messageInput.value = ""; // مسح الرسالة بعد الإرسال
  }
}

socket.on("message", (message) => {
  const messagesDiv = document.getElementById("messages");
  const messageElement = document.createElement("p");
  messageElement.innerText = message;
  messagesDiv.appendChild(messageElement);
});

socket.on("roomUsers", ({ users }) => {
  document.getElementById("users").innerHTML = users
    .map((user) => `<p>${user.username}</p>`)
    .join("");
});

function disconnect() {
  socket.emit("disconnectRoom");
  window.location.href = "/";
}

document.getElementById("copyButton").addEventListener("click", function () {
  // نسخ الكود إلى الـ clipboard
  const roomCode = new URL(window.location.href).searchParams.get("room");
  navigator.clipboard.writeText(roomCode).then(() => {
    const copyButton = document.getElementById("copyButton");

    // حفظ النص الأصلي
    const originalText = copyButton.innerHTML;

    // إضافة الكلاس لإخفاء الزر تدريجيًا
    copyButton.classList.add("hidden");

    // تغيير النص بعد انتهاء تأثير الإخفاء (نصف ثانية)
    setTimeout(() => {
      copyButton.innerHTML = '<i class="fas fa-check"></i> Done';
      copyButton.classList.remove("hidden"); // إعادة إظهاره تدريجيًا
    }, 500); // 500 مللي ثانية = 0.5 ثانية

    // إرجاع النص الأصلي بعد 2 ثانية من ظهور "Copied!"
    setTimeout(() => {
      copyButton.classList.add("hidden");
      setTimeout(() => {
        copyButton.innerHTML = originalText;
        copyButton.classList.remove("hidden"); // إعادة إظهاره للنص الأصلي
      }, 500); // نفس المدة لتأثير التلاشي
    }, 2000); // 2000 مللي ثانية = 2 ثانية
  });
});
