export type Language = 'en' | 'my';

export const translations = {
  en: {
    // Nav
    studio: 'Studio Stage',
    characters: 'Characters',
    voices: 'Voice Lab',
    video: 'Video Studio',
    broadcast: 'OBS Broadcast',
    photoAvatar: 'Photo Avatar',
    img2char: 'Image → Character',
    settings: 'Settings',

    // Stage Modes
    modePhoto: '📸 Realistic Photo Avatar',
    mode3D: '🌐 3D Humanoid Engine',
    photoBadge: 'Ultra-Realistic Real Human & Cosplay Photo with Speech Lip-Sync',
    threeDBadge: 'Full 360° Rotatable 3D WebGL Avatar Engine',

    // Zoom & Controls
    zoomBust: 'Portrait Bust',
    zoomFace: 'Face Close-up',
    zoomFull: 'Full View',
    mouthPos: 'Mouth Position',
    uploadPhoto: 'Upload Custom Photo',
    uploadVRM: 'Upload Custom 3D Model',
    readyPlayerMe: 'Ready Player Me 3D',
    openRPMCreator: 'Create 3D Avatar (Selfie)',

    // Categories
    catAll: 'All',
    catPhoto: '📸 Realistic Photo',
    catAnime: '🌸 Anime 3D',
    catRealistic: '👤 Realistic 3D',
    catMyanmar: '🇲🇲 Myanmar 3D',
    catArmy: '🎖️ Army Tactical',
    catStreamer: '🎙️ Streamer',

    // Sidebar
    emotions: 'Facial Expressions',
    voiceEngine: 'Neural Voice Engine (Edge-TTS)',
    selectVoice: 'Select Voice',
    speechScript: 'Speech Script',
    generateSpeak: 'Generate & Speak',
    characterLibrary: 'Character Library',
    obsSettings: 'OBS Live Streaming',
    bgCyber: 'Cyber Studio',
    bgGreen: 'Green Screen',
    bgTrans: 'Transparent (OBS)',

    // Status
    actor: 'Actor',
    voice: 'Voice',
    emotion: 'Emotion',
    speaking: 'Speaking (Lip-Sync)',
    online: 'Port 5180 Live',
    liveMic: 'Live Mic Input',
    micActive: 'Mic Active (Live Lip-Sync)',
    voiceRate: 'Speech Speed',
    voicePitch: 'Voice Pitch',

    // Delete & Reset
    delete: 'Delete',
    deletePhoto: 'Delete Photo',
    removePhoto: 'Remove Photo / Reset',
    deleteChar: 'Delete Character',
    deleteConfirm: 'Are you sure you want to delete this character/photo?',
    resetDefaults: 'Reset to Defaults',
    deletedSuccess: 'Removed successfully',
    customTag: 'Custom',
  },
  my: {
    // Nav
    studio: 'စတူဒီယို (Studio)',
    characters: 'ဇာတ်ကောင်များ (Characters)',
    voices: 'အသံဖန်တီးခန်း (Voice Lab)',
    video: 'ဗီဒီယို (Video)',
    broadcast: 'OBS ထုတ်လွှင့်မှု (Broadcast)',
    photoAvatar: 'ဓာတ်ပုံ Avatar (Photo)',
    img2char: 'ပုံစံပြောင်း (Convert)',
    settings: 'ဆက်တင် (Settings)',

    // Stage Modes
    modePhoto: '📸 ဓာတ်ပုံ Avatar (လူစစ်စစ်)',
    mode3D: '🌐 3D ရုပ်ထွက် (3D Avatar)',
    photoBadge: 'လူစစ်စစ် ဓာတ်ပုံမျက်နှာမပျက် စကားပြော Lip-Sync စနစ်',
    threeDBadge: '၃၆၀ ဒီဂရီ လှည့်ကြည့်နိုင်သော 3D WebGL စနစ်',

    // Zoom & Controls
    zoomBust: 'ရင်ဘတ်ပိုင်း (Bust)',
    zoomFace: 'မျက်နှာအနီးကပ် (Face)',
    zoomFull: 'တစ်ကိုယ်လုံး (Full)',
    mouthPos: 'နှုတ်ခမ်းနေရာညှိရန်',
    uploadPhoto: 'ကိုယ်ပိုင်ဓာတ်ပုံတင်ရန်',
    uploadVRM: 'ကိုယ်ပိုင် 3D တင်ရန်',
    readyPlayerMe: 'Ready Player Me 3D',
    openRPMCreator: 'Selfie ဖြင့် 3D လုပ်ရန်',

    // Categories
    catAll: 'အားလုံး',
    catPhoto: '📸 လူစစ်စစ် ဓာတ်ပုံ',
    catAnime: '🌸 အန်နီမေး 3D',
    catRealistic: '👤 လူရုပ်စစ်စစ် 3D',
    catMyanmar: '🇲🇲 မြန်မာရိုးရာ 3D',
    catArmy: '🎖️ တပ်မတော် 3D',
    catStreamer: '🎙️ စထရီမာ 3D',

    // Sidebar
    emotions: 'ခံစားချက်များ (Emotions)',
    voiceEngine: 'အသံစနစ် (Edge-TTS)',
    selectVoice: 'အသံရွေးချယ်ပါ',
    speechScript: 'ပြောကြားမည့်စာသား',
    generateSpeak: 'အသံထုတ်ပြီး ပြောပါ',
    characterLibrary: 'ဇာတ်ကောင်စာရင်း',
    obsSettings: 'OBS ထုတ်လွှင့်မှု',
    bgCyber: 'စတူဒီယို အမည်း',
    bgGreen: 'အစိမ်းခံ (Green Screen)',
    bgTrans: 'နောက်ခံဖျောက် (OBS)',

    // Status
    actor: 'ဇာတ်ကောင်',
    voice: 'အသံ',
    emotion: 'ခံစားချက်',
    speaking: 'အသံပြောနေသည်',
    online: 'Port 5180 အသင့်',
    liveMic: 'မိုက်ခရိုဖုန်း တိုက်ရိုက်ပြောရန်',
    micActive: 'မိုက် ဖွင့်ထားသည် (အသံအတိုင်း ပါးစပ်လှုပ်မည်)',
    voiceRate: 'အပြော အမြန်နှုန်း',
    voicePitch: 'အသံ အနိမ့်အမြင့်',

    // Delete & Reset
    delete: 'ဖျက်မည်',
    deletePhoto: 'ဓာတ်ပုံဖျက်မည်',
    removePhoto: 'ဓာတ်ပုံဖျက် / မူလပြန်ထား',
    deleteChar: 'ဇာတ်ကောင်ဖျက်မည်',
    deleteConfirm: 'ဤဓာတ်ပုံ/ဇာတ်ကောင်ကို ဖျက်မှာ သေချာပါသလား?',
    resetDefaults: 'မူလအတိုင်း ပြန်ထားမည်',
    deletedSuccess: 'အောင်မြင်စွာ ဖျက်ပြီးပါပြီ',
    customTag: 'စိတ်ကြိုက်',
  },
};
