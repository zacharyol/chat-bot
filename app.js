const messagesEl = document.getElementById("messages");
const emptyStateEl = document.getElementById("empty-state");
const promptInputEl = document.getElementById("prompt-input");
const sendBtnEl = document.getElementById("send-btn");
const clearBtnEl = document.getElementById("clear-btn");
const newChatBtnEl = document.getElementById("new-chat-btn");
const personalizeBtnEl = document.getElementById("personalize-btn");
const closeSettingsBtnEl = document.getElementById("close-settings-btn");
const signInBtnEl = document.getElementById("sign-in-btn");
const signOutBtnEl = document.getElementById("sign-out-btn");
const statusTextEl = document.getElementById("status-text");
const authStatusEl = document.getElementById("auth-status");
const identityNoteEl = document.getElementById("identity-note");
const modelSelectEl = document.getElementById("model-select");
const modelsStatusEl = document.getElementById("models-status");
const promptChipEls = document.querySelectorAll(".prompt-chip");
const chatHistoryEl = document.getElementById("chat-history");
const settingsPanelEl = document.getElementById("settings-panel");
const customInstructionsEl = document.getElementById("custom-instructions");
const responseStyleSelectEl = document.getElementById("response-style-select");
const creativitySelectEl = document.getElementById("creativity-select");
const htmlPreviewToggleEl = document.getElementById("html-preview-toggle");
const selfAwareToggleEl = document.getElementById("self-aware-toggle");
const voiceProviderSelectEl = document.getElementById("voice-provider-select");
const voiceSearchInputEl = document.getElementById("voice-search-input");
const voiceSelectEl = document.getElementById("voice-select");
const refreshVoicesBtnEl = document.getElementById("refresh-voices-btn");
const ttsStatusEl = document.getElementById("tts-status");
const speakLastBtnEl = document.getElementById("speak-last-btn");
const generateImageBtnEl = document.getElementById("generate-image-btn");
const aiVsAiToggleBtnEl = document.getElementById("ai-vs-ai-toggle-btn");
const aiVsAiSectionEl = document.getElementById("ai-vs-ai-section");
const aiVsAiTopicEl = document.getElementById("ai-vs-ai-topic");
const aiVsAiModelAEl = document.getElementById("ai-vs-ai-model-a");
const aiVsAiModelBEl = document.getElementById("ai-vs-ai-model-b");
const aiVsAiTurnsEl = document.getElementById("ai-vs-ai-turns");
const aiVsAiStatusEl = document.getElementById("ai-vs-ai-status");
const aiVsAiStartBtnEl = document.getElementById("ai-vs-ai-start-btn");
const aiVsAiStopBtnEl = document.getElementById("ai-vs-ai-stop-btn");

const DEFAULT_MODEL = "gpt-5.4-nano";
const SESSION_TOKEN_KEY = "puter-chat-session-token";
const LOCAL_STATE_PREFIX = "puter-chat-local:";
const CLOUD_STATE_PREFIX = "puter-chat-cloud:";
const SETTINGS_KEY = "puter-chat-panel-open";
const TTS_HOST = "https://support.readaloud.app";
const TTS_VOICE_URL = `${TTS_HOST}/read-aloud/list-voices/premium`;
const SOURCE_FILE_SPECS = [
  {
    path: "./index.html",
    label: "index.html",
    maxChars: 7000,
    keywords: ["html", "layout", "ui", "page", "sidebar", "header", "footer", "index.html"]
  },
  {
    path: "./styles.css",
    label: "styles.css",
    maxChars: 9000,
    keywords: ["css", "style", "design", "look", "theme", "color", "responsive", "styles.css"]
  },
  {
    path: "./app.js",
    label: "app.js",
    maxChars: 14000,
    keywords: ["js", "javascript", "logic", "function", "chat", "model", "prompt", "app.js", "code"]
  },
  {
    path: "./licence",
    label: "licence",
    maxChars: 3000,
    keywords: ["license", "licence", "agpl", "open source"]
  }
];

const DEFAULT_PREFERENCES = {
  customInstructions: "",
  responseStyle: "balanced",
  creativity: "0.7",
  showHtmlPreview: true,
  selfAwareMode: true,
  voiceId: ""
};

const state = {
  sending: false,
  profile: null,
  sessionToken: getOrCreateSessionToken(),
  preferences: { ...DEFAULT_PREFERENCES },
  chats: [],
  activeChatId: null,
  modelMetaById: {},
  voices: [],
  lastAssistantText: "",
  ttsAudio: null,
  aiVsAiRunning: false,
  aiVsAiStopRequested: false,
  sourceFiles: {},
  sourceContextReady: false
};

function getOrCreateSessionToken() {
  const existingToken = localStorage.getItem(SESSION_TOKEN_KEY);
  if (existingToken) {
    return existingToken;
  }

  const nextToken = crypto.randomUUID();
  localStorage.setItem(SESSION_TOKEN_KEY, nextToken);
  return nextToken;
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createEmptyChat() {
  const now = Date.now();
  return {
    id: createId("chat"),
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

function getProfileIdentifier(profile) {
  if (!profile) {
    return null;
  }

  return (
    profile.id ||
    profile.uuid ||
    profile.uid ||
    profile.username ||
    profile.email ||
    profile.name ||
    null
  );
}

function getStorageIdentity() {
  const profileId = getProfileIdentifier(state.profile);
  return profileId ? `user:${profileId}` : `token:${state.sessionToken}`;
}

function getLocalStateKey() {
  return `${LOCAL_STATE_PREFIX}${getStorageIdentity()}`;
}

function getCloudStateKey() {
  return `${CLOUD_STATE_PREFIX}${getStorageIdentity()}`;
}

function setStatus(text) {
  statusTextEl.textContent = text;
}

function setTtsStatus(text) {
  ttsStatusEl.textContent = text;
}

function setAiVsAiStatus(text) {
  aiVsAiStatusEl.textContent = text;
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n\n/* truncated for prompt size */`;
}

function isSourceAwarePrompt(prompt) {
  const lowerPrompt = (prompt || "").toLowerCase();
  return [
    "this website",
    "this site",
    "source",
    "code",
    "build",
    "feature",
    "edit",
    "change",
    "how it works",
    "how does this work",
    "app.js",
    "styles.css",
    "index.html",
    "license",
    "licence",
    "agpl"
  ].some((term) => lowerPrompt.includes(term));
}

async function loadSourceContext() {
  try {
    const results = await Promise.all(
      SOURCE_FILE_SPECS.map(async (spec) => {
        const response = await fetch(spec.path, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load ${spec.label}`);
        }

        return [spec.label, await response.text()];
      })
    );

    state.sourceFiles = Object.fromEntries(results);
    state.sourceContextReady = true;
  } catch (error) {
    state.sourceFiles = {};
    state.sourceContextReady = false;
  }
}

function buildSourceContext(prompt) {
  if (!state.preferences.selfAwareMode || !isSourceAwarePrompt(prompt)) {
    return "";
  }

  const lowerPrompt = prompt.toLowerCase();
  const matchingSpecs = SOURCE_FILE_SPECS.filter((spec) =>
    spec.keywords.some((keyword) => lowerPrompt.includes(keyword))
  );

  const selectedSpecs = matchingSpecs.length
    ? matchingSpecs
    : SOURCE_FILE_SPECS.filter((spec) => spec.label !== "licence");

  if (!state.sourceContextReady || !selectedSpecs.length) {
    return [
      "Website source context is not loaded right now.",
      "If you discuss the website source or license, treat it as open source under the AGPL-3.0 license."
    ].join(" ");
  }

  const fileBlocks = selectedSpecs
    .map((spec) => {
      const fileText = state.sourceFiles[spec.label];
      if (!fileText) {
        return "";
      }

      return [
        `FILE: ${spec.label}`,
        truncateText(fileText, spec.maxChars)
      ].join("\n");
    })
    .filter(Boolean);

  if (!fileBlocks.length) {
    return "";
  }

  return [
    "Use the current website source files below as real project context.",
    "Base explanations, code suggestions, and build ideas on these files.",
    "If you mention the website source or licensing, say it is open source under the AGPL-3.0 license.",
    fileBlocks.join("\n\n")
  ].join("\n\n");
}

function syncEmptyState() {
  const activeChat = getActiveChat();
  const hasConversation = Boolean(activeChat && activeChat.messages.length);
  emptyStateEl.classList.toggle("is-hidden", hasConversation);
}

function scrollMessagesToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatTime(timestamp) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(timestamp);
  } catch (error) {
    return "";
  }
}

function summarizeTitle(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "New chat";
  }
  return clean.length > 36 ? `${clean.slice(0, 36)}...` : clean;
}

function getActiveChat() {
  return state.chats.find((chat) => chat.id === state.activeChatId) || null;
}

function ensureActiveChat() {
  let chat = getActiveChat();
  if (chat) {
    return chat;
  }

  chat = createEmptyChat();
  state.chats = [chat];
  state.activeChatId = chat.id;
  return chat;
}

function serializeState() {
  const trimmedChats = state.chats.slice(0, 20).map((chat) => ({
    ...chat,
    messages: chat.messages.slice(-40)
  }));

  return {
    preferences: state.preferences,
    chats: trimmedChats,
    activeChatId: state.activeChatId,
    updatedAt: Date.now()
  };
}

async function persistState() {
  const payload = serializeState();
  localStorage.setItem(getLocalStateKey(), JSON.stringify(payload));

  if (!state.profile) {
    return;
  }

  try {
    await puter.kv.set(getCloudStateKey(), payload);
  } catch (error) {
    setStatus("Saved locally. Cloud sync unavailable right now.");
  }
}

function sanitizeMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  return {
    id: message.id || createId("msg"),
    role: message.role === "assistant" ? "assistant" : "user",
    type: message.type === "image" ? "image" : "text",
    content: typeof message.content === "string" ? message.content : "",
    imageSrc: typeof message.imageSrc === "string" ? message.imageSrc : "",
    prompt: typeof message.prompt === "string" ? message.prompt : "",
    speakerLabel: typeof message.speakerLabel === "string" ? message.speakerLabel : "",
    avatarText: typeof message.avatarText === "string" ? message.avatarText : ""
  };
}

function sanitizeChats(chats) {
  if (!Array.isArray(chats)) {
    return [createEmptyChat()];
  }

  const nextChats = chats
    .map((chat) => {
      if (!chat || typeof chat !== "object") {
        return null;
      }

      const messages = Array.isArray(chat.messages)
        ? chat.messages.map(sanitizeMessage).filter(Boolean)
        : [];

      return {
        id: chat.id || createId("chat"),
        title: typeof chat.title === "string" && chat.title ? chat.title : "New chat",
        createdAt: Number(chat.createdAt) || Date.now(),
        updatedAt: Number(chat.updatedAt) || Date.now(),
        messages
      };
    })
    .filter(Boolean);

  return nextChats.length ? nextChats : [createEmptyChat()];
}

function applyPreferencesToUI() {
  customInstructionsEl.value = state.preferences.customInstructions;
  responseStyleSelectEl.value = state.preferences.responseStyle;
  creativitySelectEl.value = state.preferences.creativity;
  htmlPreviewToggleEl.checked = state.preferences.showHtmlPreview;
  selfAwareToggleEl.checked = state.preferences.selfAwareMode;
  if (state.preferences.voiceId) {
    voiceSelectEl.value = state.preferences.voiceId;
  }
}

function readPreferencesFromUI() {
  state.preferences = {
    customInstructions: customInstructionsEl.value.trim(),
    responseStyle: responseStyleSelectEl.value,
    creativity: creativitySelectEl.value,
    showHtmlPreview: htmlPreviewToggleEl.checked,
    selfAwareMode: selfAwareToggleEl.checked,
    voiceId: voiceSelectEl.value
  };
}

function updateIdentityNote() {
  const shortToken = state.sessionToken.slice(0, 8);
  const profileId = getProfileIdentifier(state.profile);
  identityNoteEl.textContent = profileId
    ? `Recognized as ${profileId}. Session token ${shortToken}.`
    : `Local token ${shortToken} keeps this browser recognized.`;
}

function isUsageBasedModel(model) {
  const cost = model?.cost;
  if (!cost || typeof cost !== "object") {
    return false;
  }

  return Number(cost.input || 0) > 0 || Number(cost.output || 0) > 0;
}

function getModelTierLabel(modelId) {
  const model = state.modelMetaById[modelId];
  if (!model) {
    return "Unknown pricing";
  }

  return isUsageBasedModel(model) ? "Usage-based" : "Free / included";
}

function updateSelectedModelStatus() {
  const selectedId = modelSelectEl.value;
  const tier = getModelTierLabel(selectedId);
  const model = state.modelMetaById[selectedId];
  const name = model?.name || selectedId || DEFAULT_MODEL;

  modelsStatusEl.textContent = `${name} is in the ${tier.toLowerCase()} section`;
}

function appendModelGroup(groupLabel, models) {
  if (!models.length) {
    return;
  }

  const groupEl = document.createElement("optgroup");
  groupEl.label = groupLabel;

  models.forEach((model) => {
    const optionEl = document.createElement("option");
    optionEl.value = model.id;
    optionEl.textContent = `${model.name || model.id} (${model.provider})`;
    groupEl.appendChild(optionEl);
  });

  return groupEl;
}

function populateModelSelect(selectEl, freeModels, usageBasedModels, fallbackValue) {
  const currentValue = selectEl.value;
  selectEl.innerHTML = "";

  const freeGroup = appendModelGroup("Free / included", freeModels);
  const usageGroup = appendModelGroup("Usage-based / paid", usageBasedModels);

  if (freeGroup) {
    selectEl.appendChild(freeGroup);
  }

  if (usageGroup) {
    selectEl.appendChild(usageGroup);
  }

  const allModels = [...freeModels, ...usageBasedModels];
  const nextValue = allModels.some((model) => model.id === currentValue)
    ? currentValue
    : allModels.some((model) => model.id === fallbackValue)
      ? fallbackValue
      : allModels[0]?.id || fallbackValue;

  selectEl.value = nextValue;
}

function getModelDisplayName(modelId) {
  const model = state.modelMetaById[modelId];
  return model?.name || modelId;
}

function setSettingsOpen(isOpen) {
  settingsPanelEl.classList.toggle("is-hidden", !isOpen);
  localStorage.setItem(SETTINGS_KEY, isOpen ? "open" : "closed");
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatInlineMarkdown(value) {
  let formatted = escapeHtml(value);
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  formatted = formatted.replace(/`([^`\n]+)`/g, "<code class=\"inline-code\">$1</code>");
  return formatted;
}

function renderMarkdownTextBlock(containerEl, text) {
  const sections = text
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  sections.forEach((section) => {
    const lines = section.split("\n").map((line) => line.trimEnd());
    const nonEmptyLines = lines.filter((line) => line.trim());

    if (!nonEmptyLines.length) {
      return;
    }

    const bulletMatch = nonEmptyLines.every((line) => /^[-*]\s+/.test(line.trim()));
    if (bulletMatch) {
      const listEl = document.createElement("ul");
      listEl.className = "message-list";
      nonEmptyLines.forEach((line) => {
        const itemEl = document.createElement("li");
        itemEl.innerHTML = formatInlineMarkdown(line.trim().replace(/^[-*]\s+/, ""));
        listEl.appendChild(itemEl);
      });
      containerEl.appendChild(listEl);
      return;
    }

    const numberedMatch = nonEmptyLines.every((line) => /^\d+\.\s+/.test(line.trim()));
    if (numberedMatch) {
      const listEl = document.createElement("ol");
      listEl.className = "message-list message-list-numbered";
      nonEmptyLines.forEach((line) => {
        const itemEl = document.createElement("li");
        itemEl.innerHTML = formatInlineMarkdown(line.trim().replace(/^\d+\.\s+/, ""));
        listEl.appendChild(itemEl);
      });
      containerEl.appendChild(listEl);
      return;
    }

    if (nonEmptyLines.length === 1) {
      const headingLine = nonEmptyLines[0].trim();
      const headingMatch = headingLine.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        const level = Math.min(headingMatch[1].length, 3) + 1;
        const headingEl = document.createElement(`h${level}`);
        headingEl.className = "message-heading";
        headingEl.innerHTML = formatInlineMarkdown(headingMatch[2].trim());
        containerEl.appendChild(headingEl);
        return;
      }
    }

    const paragraphEl = document.createElement("p");
    paragraphEl.className = "text-block";
    paragraphEl.innerHTML = lines
      .map((line) => formatInlineMarkdown(line))
      .join("<br>");
    containerEl.appendChild(paragraphEl);
  });
}

function parseContentBlocks(content) {
  const blocks = [];
  const pattern = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({
        type: "text",
        value: content.slice(lastIndex, match.index)
      });
    }

    blocks.push({
      type: "code",
      language: (match[1] || "text").toLowerCase(),
      value: match[2].replace(/\n$/, "")
    });

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < content.length) {
    blocks.push({
      type: "text",
      value: content.slice(lastIndex)
    });
  }

  return blocks.length ? blocks : [{ type: "text", value: content }];
}

async function copyCode(code, buttonEl) {
  try {
    await navigator.clipboard.writeText(code);
    const oldLabel = buttonEl.textContent;
    buttonEl.textContent = "Copied";
    window.setTimeout(() => {
      buttonEl.textContent = oldLabel;
    }, 1200);
  } catch (error) {
    buttonEl.textContent = "Copy failed";
    window.setTimeout(() => {
      buttonEl.textContent = "Copy";
    }, 1200);
  }
}

function renderRichContent(containerEl, content, role) {
  if (role === "user") {
    containerEl.textContent = content;
    return;
  }

  containerEl.innerHTML = "";

  const blocks = parseContentBlocks(content);

  blocks.forEach((block) => {
    if (block.type === "text") {
      const trimmed = block.value.trim();
      if (!trimmed) {
        return;
      }

      renderMarkdownTextBlock(containerEl, trimmed);
      return;
    }

    const codeBlockEl = document.createElement("section");
    codeBlockEl.className = "code-block";

    const codeHeaderEl = document.createElement("div");
    codeHeaderEl.className = "code-header";

    const codeLanguageEl = document.createElement("span");
    codeLanguageEl.className = "code-language";
    codeLanguageEl.textContent = block.language;

    const copyBtnEl = document.createElement("button");
    copyBtnEl.className = "copy-button";
    copyBtnEl.type = "button";
    copyBtnEl.textContent = "Copy";
    copyBtnEl.addEventListener("click", () => {
      copyCode(block.value, copyBtnEl);
    });

    const preEl = document.createElement("pre");
    const codeEl = document.createElement("code");
    codeEl.textContent = block.value;
    preEl.appendChild(codeEl);

    codeHeaderEl.append(codeLanguageEl, copyBtnEl);
    codeBlockEl.append(codeHeaderEl, preEl);

    if (block.language === "html" && state.preferences.showHtmlPreview) {
      const previewWrapEl = document.createElement("div");
      previewWrapEl.className = "preview-block";

      const previewLabelEl = document.createElement("div");
      previewLabelEl.className = "preview-label";
      previewLabelEl.textContent = "Live preview";

      const iframeEl = document.createElement("iframe");
      iframeEl.className = "preview-frame";
      iframeEl.setAttribute("title", "HTML preview");
      iframeEl.setAttribute("sandbox", "allow-scripts");
      iframeEl.srcdoc = block.value;

      previewWrapEl.append(previewLabelEl, iframeEl);
      codeBlockEl.appendChild(previewWrapEl);
    }

    containerEl.appendChild(codeBlockEl);
  });
}

function createMessageElement(message) {
  const displayLabel = message.speakerLabel || (message.role === "user" ? "You" : "AI");
  const avatarText = message.avatarText || (message.role === "user" ? "You" : "AI");
  const messageEl = document.createElement("article");
  messageEl.className = `message ${message.role}`;

  const innerEl = document.createElement("div");
  innerEl.className = "message-inner";

  const avatarEl = document.createElement("div");
  avatarEl.className = "message-avatar";
  avatarEl.textContent = avatarText;

  const bodyEl = document.createElement("div");
  bodyEl.className = "message-body";

  const labelEl = document.createElement("span");
  labelEl.className = "message-label";
  labelEl.textContent = displayLabel;

  const contentEl = document.createElement("div");
  contentEl.className = "message-content";

  if (message.type === "image") {
    const textEl = document.createElement("div");
    textEl.className = "text-block";
    textEl.textContent = message.content;

    const imageWrapEl = document.createElement("div");
    imageWrapEl.className = "generated-image";

    const imageEl = document.createElement("img");
    imageEl.src = message.imageSrc;
    imageEl.alt = message.prompt || "Generated image";
    imageWrapEl.appendChild(imageEl);

    contentEl.append(textEl, imageWrapEl);
  } else {
    renderRichContent(contentEl, message.content, message.role);
  }

  bodyEl.append(labelEl, contentEl);
  innerEl.append(avatarEl, bodyEl);
  messageEl.appendChild(innerEl);

  return { messageEl, contentEl };
}

function appendMessage(message) {
  const { messageEl, contentEl } = createMessageElement(message);
  messagesEl.appendChild(messageEl);
  syncEmptyState();
  scrollMessagesToBottom();
  return contentEl;
}

function renderChatHistory() {
  chatHistoryEl.innerHTML = "";

  state.chats
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .forEach((chat) => {
      const buttonEl = document.createElement("button");
      buttonEl.type = "button";
      buttonEl.className = `history-item${chat.id === state.activeChatId ? " is-active" : ""}`;
      buttonEl.addEventListener("click", () => {
        state.activeChatId = chat.id;
        renderChatHistory();
        renderActiveChat();
        persistState();
      });

      const titleEl = document.createElement("span");
      titleEl.className = "history-title";
      titleEl.textContent = chat.title;

      const metaEl = document.createElement("span");
      metaEl.className = "history-meta";
      metaEl.textContent = formatTime(chat.updatedAt);

      buttonEl.append(titleEl, metaEl);
      chatHistoryEl.appendChild(buttonEl);
    });
}

function renderActiveChat() {
  const activeChat = ensureActiveChat();
  messagesEl.innerHTML = "";
  state.lastAssistantText = "";

  activeChat.messages.forEach((message) => {
    appendMessage(message);
    if (message.role === "assistant" && message.type === "text") {
      state.lastAssistantText = message.content;
    }
  });

  syncEmptyState();
}

function updateChatTitle(chat, prompt) {
  if (chat.title === "New chat") {
    chat.title = summarizeTitle(prompt);
  }
  chat.updatedAt = Date.now();
}

function setSending(isSending) {
  state.sending = isSending;
  sendBtnEl.disabled = isSending;
  signInBtnEl.disabled = isSending;
  signOutBtnEl.disabled = isSending;
  modelSelectEl.disabled = isSending;
  promptInputEl.disabled = isSending;
  speakLastBtnEl.disabled = isSending;
  generateImageBtnEl.disabled = isSending;
}

function setAiVsAiRunning(isRunning) {
  state.aiVsAiRunning = isRunning;
  aiVsAiStartBtnEl.disabled = isRunning;
  aiVsAiStopBtnEl.disabled = !isRunning;
  aiVsAiModelAEl.disabled = isRunning;
  aiVsAiModelBEl.disabled = isRunning;
  aiVsAiTurnsEl.disabled = isRunning;
  aiVsAiTopicEl.disabled = isRunning;
}

async function loadPersistedData() {
  let payload = null;

  try {
    if (state.profile) {
      payload = await puter.kv.get(getCloudStateKey());
    }
  } catch (error) {
    payload = null;
  }

  if (!payload) {
    const localPayload = localStorage.getItem(getLocalStateKey());
    payload = localPayload ? JSON.parse(localPayload) : null;
  }

  state.preferences = {
    ...DEFAULT_PREFERENCES,
    ...(payload?.preferences || {})
  };
  state.chats = sanitizeChats(payload?.chats);
  state.activeChatId =
    payload?.activeChatId && state.chats.some((chat) => chat.id === payload.activeChatId)
      ? payload.activeChatId
      : state.chats[0].id;

  applyPreferencesToUI();
  renderChatHistory();
  renderActiveChat();
}

async function refreshAuthStatus() {
  try {
    const signedIn = puter.auth.isSignedIn();

    if (!signedIn) {
      state.profile = null;
      authStatusEl.textContent = "Not signed in yet. Local chat history is still saved here.";
      signInBtnEl.textContent = "Sign in with Puter";
      signOutBtnEl.hidden = true;
      updateIdentityNote();
      return;
    }

    state.profile = await puter.auth.getUser();
    const profileId = getProfileIdentifier(state.profile) || "Puter user";
    authStatusEl.textContent = `Signed in as ${profileId}.`;
    signInBtnEl.textContent = "Refresh Puter account";
    signOutBtnEl.hidden = false;
    updateIdentityNote();
  } catch (error) {
    authStatusEl.textContent = "Puter auth status is not available right now.";
    signOutBtnEl.hidden = true;
    updateIdentityNote();
  }
}

async function ensureSignedIn() {
  if (puter.auth.isSignedIn()) {
    if (!state.profile) {
      await refreshAuthStatus();
      await loadPersistedData();
    }
    return;
  }

  setStatus("Waiting for Puter sign-in...");
  await puter.auth.signIn();
  await refreshAuthStatus();
  await loadPersistedData();
}

async function signOutFromPuter() {
  if (state.sending) {
    return;
  }

  try {
    setSending(true);
    setStatus("Signing out...");
    await puter.auth.signOut();
    state.profile = null;
    await refreshAuthStatus();
    await loadPersistedData();
    setStatus("Signed out");
  } catch (error) {
    setStatus(error?.message || "Sign-out failed");
  } finally {
    setSending(false);
  }
}

function buildSystemPrompt() {
  const styleInstructions = {
    concise: "Keep answers short and direct.",
    balanced: "Keep answers clear and balanced.",
    detailed: "Give detailed step-by-step answers.",
    "code-heavy": "Prefer code examples, practical structure, and implementation details."
  };

  const customLine = state.preferences.customInstructions
    ? `Additional instructions: ${state.preferences.customInstructions}`
    : "";
  const selfAwareLine = state.preferences.selfAwareMode
    ? [
        "You are mc gpt, the assistant for this website.",
        "If the user asks about this website, its code, source, features, or how it works, answer using the website itself as context.",
        "When you talk about this website's source code or licensing, say it is open source under the AGPL-3.0 license.",
        "Only mention the AGPL-3.0 license when the conversation is about the source, code, or licensing.",
        "Do not invent features or files that are not part of the website."
      ].join(" ")
    : "";

  return [
    "You are a helpful AI assistant in a simple website.",
    "Keep answers friendly and practical.",
    styleInstructions[state.preferences.responseStyle] || styleInstructions.balanced,
    selfAwareLine,
    customLine
  ]
    .filter(Boolean)
    .join(" ");
}

function buildChatPayload(chat) {
  const textMessages = chat.messages
    .filter((message) => message.type === "text")
    .map((message) => ({
      role: message.role,
      content: message.content
    }));

  const latestUserMessage = [...textMessages]
    .reverse()
    .find((message) => message.role === "user");
  const sourceContext = buildSourceContext(latestUserMessage?.content || "");

  return [
    {
      role: "system",
      content: buildSystemPrompt()
    },
    ...(sourceContext
      ? [
          {
            role: "system",
            content: sourceContext
          }
        ]
      : []),
    ...textMessages
  ];
}

function getChatResponseText(response) {
  if (!response) {
    return "";
  }

  if (typeof response === "string") {
    return response;
  }

  return (
    response?.message?.content ||
    response?.content ||
    response?.text ||
    ""
  );
}

async function sendMessage() {
  const prompt = promptInputEl.value.trim();
  if (!prompt || state.sending) {
    return;
  }

  const activeChat = ensureActiveChat();
  const userMessage = {
    id: createId("msg"),
    role: "user",
    type: "text",
    content: prompt
  };

  activeChat.messages.push(userMessage);
  updateChatTitle(activeChat, prompt);
  renderChatHistory();
  appendMessage(userMessage);

  promptInputEl.value = "";
  autoResizeTextarea();
  setSending(true);
  setStatus("Contacting model...");

  let assistantText = "";
  const assistantPlaceholderEl = appendMessage({
    id: createId("msg"),
    role: "assistant",
    type: "text",
    content: "Thinking..."
  });

  try {
    await ensureSignedIn();

    const stream = await puter.ai.chat(buildChatPayload(activeChat), false, {
      model: modelSelectEl.value || DEFAULT_MODEL,
      stream: true,
      temperature: Number(state.preferences.creativity)
    });

    assistantPlaceholderEl.textContent = "";
    setStatus("Streaming response...");

    for await (const part of stream) {
      const textPart = part?.text ?? "";
      assistantText += textPart;
      renderRichContent(assistantPlaceholderEl, assistantText || "Thinking...", "assistant");
      scrollMessagesToBottom();
    }

    const assistantMessage = {
      id: createId("msg"),
      role: "assistant",
      type: "text",
      content: assistantText || "No response received."
    };

    activeChat.messages.push(assistantMessage);
    activeChat.updatedAt = Date.now();
    state.lastAssistantText = assistantMessage.content;
    renderChatHistory();
    await persistState();
    setStatus("Ready");
  } catch (error) {
    const message =
      error?.message ||
      "Something went wrong while calling Puter. Please try again.";
    renderRichContent(assistantPlaceholderEl, `Error: ${message}`, "assistant");
    activeChat.messages.push({
      id: createId("msg"),
      role: "assistant",
      type: "text",
      content: `Error: ${message}`
    });
    await persistState();
    setStatus("Request failed");
  } finally {
    setSending(false);
    promptInputEl.focus();
  }
}

async function startAiVsAiConversation() {
  const topic = aiVsAiTopicEl.value.trim();
  if (!topic || state.sending || state.aiVsAiRunning) {
    if (!topic) {
      setAiVsAiStatus("Add a topic first");
    }
    return;
  }

  const modelA = aiVsAiModelAEl.value;
  const modelB = aiVsAiModelBEl.value;
  const maxTurns = Number(aiVsAiTurnsEl.value || 6);
  const activeChat = ensureActiveChat();
  const topicSummary = `AI vs AI: ${topic}`;

  await ensureSignedIn();

  state.aiVsAiStopRequested = false;
  setAiVsAiRunning(true);
  setSending(true);
  setAiVsAiStatus("Starting conversation...");
  setStatus("AI vs AI mode is running...");

  const introMessage = {
    id: createId("msg"),
    role: "user",
    type: "text",
    content: `${topicSummary}\nAI A: ${getModelDisplayName(modelA)}\nAI B: ${getModelDisplayName(modelB)}\nMax turns: ${maxTurns}`
  };

  activeChat.messages.push(introMessage);
  if (activeChat.title === "New chat") {
    activeChat.title = summarizeTitle(topicSummary);
  }
  activeChat.updatedAt = Date.now();
  renderChatHistory();
  appendMessage(introMessage);
  await persistState();

  const transcript = [`Topic: ${topic}`];
  const speakers = [
    {
      key: "A",
      avatarText: "A",
      label: `AI A (${getModelDisplayName(modelA)})`,
      model: modelA
    },
    {
      key: "B",
      avatarText: "B",
      label: `AI B (${getModelDisplayName(modelB)})`,
      model: modelB
    }
  ];

  try {
    for (let turnIndex = 0; turnIndex < maxTurns; turnIndex += 1) {
      if (state.aiVsAiStopRequested) {
        break;
      }

      const speaker = speakers[turnIndex % 2];
      const otherSpeaker = speakers[(turnIndex + 1) % 2];
      setAiVsAiStatus(`${speaker.label} is replying...`);

      const response = await puter.ai.chat(
        [
          {
            role: "system",
            content: [
              `You are ${speaker.label} in AI vs AI mode.`,
              `You are speaking with ${otherSpeaker.label}.`,
              "Continue the conversation naturally and do not write both sides.",
              "Keep each turn focused and reasonably short unless the topic requires more detail.",
              state.preferences.customInstructions
                ? `Extra instruction from the user: ${state.preferences.customInstructions}`
                : ""
            ]
              .filter(Boolean)
              .join(" ")
          },
          {
            role: "user",
            content: [
              `Topic: ${topic}`,
              `Conversation so far:\n${transcript.join("\n\n")}`,
              `Reply now as ${speaker.label}.`
            ].join("\n\n")
          }
        ],
        false,
        {
          model: speaker.model,
          temperature: Number(state.preferences.creativity)
        }
      );

      if (state.aiVsAiStopRequested) {
        break;
      }

      const replyText = getChatResponseText(response).trim() || "No response received.";
      transcript.push(`${speaker.label}: ${replyText}`);

      const aiMessage = {
        id: createId("msg"),
        role: "assistant",
        type: "text",
        content: replyText,
        speakerLabel: speaker.label,
        avatarText: speaker.avatarText
      };

      activeChat.messages.push(aiMessage);
      activeChat.updatedAt = Date.now();
      state.lastAssistantText = replyText;
      renderChatHistory();
      appendMessage(aiMessage);
      await persistState();
    }

    if (state.aiVsAiStopRequested) {
      setAiVsAiStatus("Interrupted by user");
      setStatus("AI vs AI interrupted");
    } else {
      setAiVsAiStatus("Conversation finished");
      setStatus("AI vs AI finished");
    }
  } catch (error) {
    const errorText = error?.message || "AI vs AI failed";
    activeChat.messages.push({
      id: createId("msg"),
      role: "assistant",
      type: "text",
      content: `Error: ${errorText}`,
      speakerLabel: "AI vs AI",
      avatarText: "!!"
    });
    renderChatHistory();
    renderActiveChat();
    await persistState();
    setAiVsAiStatus(errorText);
    setStatus("AI vs AI failed");
  } finally {
    state.aiVsAiStopRequested = false;
    setAiVsAiRunning(false);
    setSending(false);
  }
}

function stopAiVsAiConversation() {
  if (!state.aiVsAiRunning) {
    return;
  }

  state.aiVsAiStopRequested = true;
  setAiVsAiStatus("Stopping after the current reply...");
  setStatus("Stopping AI vs AI...");
}

async function generateImage() {
  const prompt = promptInputEl.value.trim();
  if (!prompt || state.sending) {
    return;
  }

  const activeChat = ensureActiveChat();
  const userMessage = {
    id: createId("msg"),
    role: "user",
    type: "text",
    content: prompt
  };

  activeChat.messages.push(userMessage);
  updateChatTitle(activeChat, prompt);
  renderChatHistory();
  appendMessage(userMessage);

  promptInputEl.value = "";
  autoResizeTextarea();
  setSending(true);
  setStatus("Generating image...");

  try {
    await ensureSignedIn();
    const generated = await puter.ai.txt2img(prompt);
    const imageSrc = Array.isArray(generated) ? generated[0]?.src : generated?.src;

    if (!imageSrc) {
      throw new Error("No image was returned.");
    }

    const imageMessage = {
      id: createId("msg"),
      role: "assistant",
      type: "image",
      content: `Generated image for: ${prompt}`,
      imageSrc,
      prompt
    };

    activeChat.messages.push(imageMessage);
    activeChat.updatedAt = Date.now();
    renderChatHistory();
    renderActiveChat();
    await persistState();
    setStatus("Image generated");
  } catch (error) {
    const failureMessage = error?.message || "Image generation failed.";
    activeChat.messages.push({
      id: createId("msg"),
      role: "assistant",
      type: "text",
      content: `Error: ${failureMessage}`
    });
    renderActiveChat();
    await persistState();
    setStatus("Image generation failed");
  } finally {
    setSending(false);
  }
}

function autoResizeTextarea() {
  promptInputEl.style.height = "0px";
  promptInputEl.style.height = `${Math.min(promptInputEl.scrollHeight, 220)}px`;
}

function resetCurrentChat() {
  const activeChat = ensureActiveChat();
  activeChat.title = "New chat";
  activeChat.updatedAt = Date.now();
  activeChat.messages = [];
  renderChatHistory();
  renderActiveChat();
  persistState();
  setStatus("Chat cleared");
}

function startNewChat() {
  const nextChat = createEmptyChat();
  state.chats.unshift(nextChat);
  state.activeChatId = nextChat.id;
  renderChatHistory();
  renderActiveChat();
  persistState();
  promptInputEl.focus();
}

async function loadModels() {
  modelsStatusEl.textContent = "Loading models...";

  try {
    const models = await puter.ai.listModels();
    const preferredOrder = [
      "gpt-5.4-nano",
      "inception/mercury-2",
      "claude-sonnet-4",
      "gemini-2.5-flash-lite"
    ];

    const sortedModels = models.slice().sort((left, right) => {
      const leftIndex = preferredOrder.indexOf(left.id);
      const rightIndex = preferredOrder.indexOf(right.id);

      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
      }

      return (left.name || left.id).localeCompare(right.name || right.id);
    });

    state.modelMetaById = Object.fromEntries(sortedModels.map((model) => [model.id, model]));

    const freeModels = sortedModels.filter((model) => !isUsageBasedModel(model));
    const usageBasedModels = sortedModels.filter((model) => isUsageBasedModel(model));

    populateModelSelect(modelSelectEl, freeModels, usageBasedModels, DEFAULT_MODEL);
    populateModelSelect(aiVsAiModelAEl, freeModels, usageBasedModels, DEFAULT_MODEL);
    populateModelSelect(
      aiVsAiModelBEl,
      freeModels,
      usageBasedModels,
      sortedModels.find((model) => model.id !== aiVsAiModelAEl.value)?.id || DEFAULT_MODEL
    );
    updateSelectedModelStatus();
  } catch (error) {
    const fallbackModels = [
      { id: "gpt-5.4-nano", provider: "openai", name: "GPT-5.4 Nano" },
      { id: "inception/mercury-2", provider: "inception", name: "Mercury 2" },
      { id: "claude-sonnet-4", provider: "anthropic", name: "Claude Sonnet 4", cost: { input: 1, output: 1 } },
      { id: "gemini-2.5-flash-lite", provider: "google", name: "Gemini 2.5 Flash Lite", cost: { input: 1, output: 1 } }
    ];

    state.modelMetaById = Object.fromEntries(fallbackModels.map((model) => [model.id, model]));
    const freeModels = fallbackModels.filter((model) => !isUsageBasedModel(model));
    const usageBasedModels = fallbackModels.filter((model) => isUsageBasedModel(model));
    populateModelSelect(modelSelectEl, freeModels, usageBasedModels, DEFAULT_MODEL);
    populateModelSelect(aiVsAiModelAEl, freeModels, usageBasedModels, DEFAULT_MODEL);
    populateModelSelect(aiVsAiModelBEl, freeModels, usageBasedModels, "inception/mercury-2");
    updateSelectedModelStatus();
  }
}

function parseVoiceInfo(voiceName, gender, lang) {
  const matcher = /^(\w+) (.+) \((.+?)\)$/;
  if (!matcher.test(voiceName)) {
    return null;
  }

  const match = matcher.exec(voiceName);
  return {
    provider: match[1],
    id: voiceName,
    name: match[3],
    desc: `${match[3]} (${match[2]})`,
    gender,
    langCode: lang,
    langName: match[2]
  };
}

function populateVoiceProviders() {
  const currentValue = voiceProviderSelectEl.value;
  const providers = [...new Set(state.voices.map((voice) => voice.provider))].sort();

  voiceProviderSelectEl.innerHTML = '<option value="">All providers</option>';

  providers.forEach((provider) => {
    const optionEl = document.createElement("option");
    optionEl.value = provider;
    optionEl.textContent = provider;
    voiceProviderSelectEl.appendChild(optionEl);
  });

  if (providers.includes(currentValue)) {
    voiceProviderSelectEl.value = currentValue;
  }
}

function getFilteredVoices() {
  const providerFilter = voiceProviderSelectEl.value.trim().toLowerCase();
  const searchFilter = voiceSearchInputEl.value.trim().toLowerCase();

  return state.voices.filter((voice) => {
    const matchesProvider = !providerFilter || voice.provider.toLowerCase() === providerFilter;
    const haystack = [
      voice.provider,
      voice.name,
      voice.desc,
      voice.langCode,
      voice.langName
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !searchFilter || haystack.includes(searchFilter);
    return matchesProvider && matchesSearch;
  });
}

function renderVoiceOptions() {
  const filteredVoices = getFilteredVoices();
  const previousValue = voiceSelectEl.value || state.preferences.voiceId;

  voiceSelectEl.innerHTML = "";

  if (!filteredVoices.length) {
    voiceSelectEl.innerHTML = '<option value="">No matching voices</option>';
    setTtsStatus("No voices match that search");
    return;
  }

  filteredVoices.forEach((voice) => {
    const optionEl = document.createElement("option");
    optionEl.value = voice.id;
    optionEl.textContent = `${voice.desc} - ${voice.provider}`;
    voiceSelectEl.appendChild(optionEl);
  });

  if (previousValue && filteredVoices.some((voice) => voice.id === previousValue)) {
    voiceSelectEl.value = previousValue;
  } else {
    voiceSelectEl.value = filteredVoices[0].id;
  }

  state.preferences.voiceId = voiceSelectEl.value;
  setTtsStatus(`${filteredVoices.length} voices shown`);
}

async function loadVoices() {
  setTtsStatus("Loading voices...");

  try {
    const response = await fetch(TTS_VOICE_URL);
    if (!response.ok) {
      throw new Error("Voice list request failed.");
    }

    const voices = await response.json();
    state.voices = voices
      .map((voice) => parseVoiceInfo(voice.voiceName, voice.gender, voice.lang))
      .filter(Boolean)
      .sort((left, right) => left.desc.localeCompare(right.desc));

    if (!state.voices.length) {
      voiceProviderSelectEl.innerHTML = '<option value="">All providers</option>';
      voiceSelectEl.innerHTML = '<option value="">No voices available</option>';
      setTtsStatus("No voices available");
      return;
    }

    populateVoiceProviders();
    renderVoiceOptions();

    if (state.preferences.voiceId && state.voices.some((voice) => voice.id === state.preferences.voiceId)) {
      voiceSelectEl.value = state.preferences.voiceId;
    }

    if (!voiceSelectEl.value && state.voices.length) {
      voiceSelectEl.value = state.voices[0].id;
      state.preferences.voiceId = state.voices[0].id;
    }

    setTtsStatus(`${state.voices.length} voices loaded`);
  } catch (error) {
    voiceProviderSelectEl.innerHTML = '<option value="">All providers</option>';
    voiceSelectEl.innerHTML = '<option value="">Voice loading failed</option>';
    setTtsStatus("TTS voice loading failed");
  }
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeTextForSpeech(text) {
  return text
    .replace(/```([a-zA-Z0-9_-]+)?/g, " code block ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

function splitSpeechText(text, maxEscapedLength, maxTotalEscapedLength) {
  const paragraphs = normalizeTextForSpeech(text)
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks = [];
  let totalEscapedLength = 0;

  function pushChunk(rawChunk) {
    const cleanedChunk = rawChunk.trim();
    if (!cleanedChunk) {
      return;
    }

    const escapedLength = escapeXml(cleanedChunk).length;
    if (escapedLength > maxEscapedLength) {
      const midpoint = Math.max(1, Math.floor(cleanedChunk.length / 2));
      let splitIndex = cleanedChunk.lastIndexOf(" ", midpoint);
      if (splitIndex < Math.floor(cleanedChunk.length * 0.3)) {
        splitIndex = midpoint;
      }

      pushChunk(cleanedChunk.slice(0, splitIndex));
      pushChunk(cleanedChunk.slice(splitIndex));
      return;
    }

    if (totalEscapedLength + escapedLength > maxTotalEscapedLength) {
      return;
    }

    chunks.push(cleanedChunk);
    totalEscapedLength += escapedLength;
  }

  paragraphs.forEach((paragraph) => {
    if (escapeXml(paragraph).length <= maxEscapedLength) {
      pushChunk(paragraph);
      return;
    }

    const sentences = paragraph.match(/[^.!?\n]+[.!?]?/g) || [paragraph];
    let currentChunk = "";

    sentences.forEach((sentence) => {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) {
        return;
      }

      const candidate = currentChunk ? `${currentChunk} ${trimmedSentence}` : trimmedSentence;
      if (escapeXml(candidate).length <= maxEscapedLength) {
        currentChunk = candidate;
      } else {
        pushChunk(currentChunk);
        currentChunk = trimmedSentence;
      }
    });

    pushChunk(currentChunk);
  });

  return chunks;
}

async function speakLastReply() {
  const text = state.lastAssistantText.trim();
  if (!text) {
    setTtsStatus("No assistant reply to speak yet");
    return;
  }

  readPreferencesFromUI();
  const voice = state.voices.find((item) => item.id === state.preferences.voiceId);
  if (!voice) {
    setTtsStatus("Choose a voice first");
    return;
  }

  setTtsStatus("Building speech...");

  try {
    const MAX_TTS_PART_ESCAPED_LENGTH = 1000;
    const MAX_TTS_TOTAL_ESCAPED_LENGTH = 10000;
    const speechChunks = splitSpeechText(
      text,
      MAX_TTS_PART_ESCAPED_LENGTH,
      MAX_TTS_TOTAL_ESCAPED_LENGTH
    );

    if (!speechChunks.length) {
      throw new Error("Nothing usable to send to TTS.");
    }

    const parts = speechChunks.map((chunk) => ({
      voiceId: voice.id,
      ssml: `<speak version="1.0" xml:lang="${voice.langCode}">${escapeXml(chunk)}</speak>`
    }));

    const createResponse = await fetch(`${TTS_HOST}/ttstool/createParts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(parts)
    });

    if (!createResponse.ok) {
      throw new Error("TTS create request failed.");
    }

    const result = await createResponse.json();
    if (!Array.isArray(result) || !result.length) {
      throw new Error("TTS did not return audio parts.");
    }

    const audioUrl = `${TTS_HOST}/ttstool/getParts?q=${result.join(",")}`;

    if (state.ttsAudio) {
      state.ttsAudio.pause();
    }

    state.ttsAudio = new Audio(audioUrl);
    state.ttsAudio.addEventListener("ended", () => {
      setTtsStatus("Playback finished");
    });
    await state.ttsAudio.play();
    setTtsStatus(
      speechChunks.length > 1
        ? `Playing speech in ${speechChunks.length} parts`
        : "Playing speech"
    );
  } catch (error) {
    setTtsStatus(error?.message || "TTS playback failed");
  }
}

async function handlePreferencesChange() {
  readPreferencesFromUI();
  renderActiveChat();
  await persistState();
}

sendBtnEl.addEventListener("click", sendMessage);
generateImageBtnEl.addEventListener("click", generateImage);
speakLastBtnEl.addEventListener("click", speakLastReply);
aiVsAiToggleBtnEl.addEventListener("click", () => {
  setSettingsOpen(true);
  aiVsAiSectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
});
aiVsAiStartBtnEl.addEventListener("click", startAiVsAiConversation);
aiVsAiStopBtnEl.addEventListener("click", stopAiVsAiConversation);

promptInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

promptInputEl.addEventListener("input", autoResizeTextarea);

clearBtnEl.addEventListener("click", resetCurrentChat);
newChatBtnEl.addEventListener("click", startNewChat);
personalizeBtnEl.addEventListener("click", () => {
  setSettingsOpen(settingsPanelEl.classList.contains("is-hidden"));
});
closeSettingsBtnEl.addEventListener("click", () => {
  setSettingsOpen(false);
});

signInBtnEl.addEventListener("click", async () => {
  try {
    setSending(true);
    await ensureSignedIn();
    await persistState();
    setStatus("Signed in");
  } catch (error) {
    setStatus(error?.message || "Sign-in failed");
  } finally {
    setSending(false);
  }
});
signOutBtnEl.addEventListener("click", signOutFromPuter);

promptChipEls.forEach((chipEl) => {
  chipEl.addEventListener("click", () => {
    promptInputEl.value = chipEl.dataset.prompt || "";
    autoResizeTextarea();
    promptInputEl.focus();
  });
});

[
  customInstructionsEl,
  responseStyleSelectEl,
  creativitySelectEl,
  htmlPreviewToggleEl,
  selfAwareToggleEl,
  voiceSelectEl
].forEach((element) => {
  element.addEventListener("change", handlePreferencesChange);
});

modelSelectEl.addEventListener("change", updateSelectedModelStatus);

refreshVoicesBtnEl.addEventListener("click", loadVoices);
voiceProviderSelectEl.addEventListener("change", renderVoiceOptions);
voiceSearchInputEl.addEventListener("input", renderVoiceOptions);

async function initializeApp() {
  autoResizeTextarea();
  setSettingsOpen(localStorage.getItem(SETTINGS_KEY) !== "closed");
  updateIdentityNote();
  setAiVsAiStatus("Idle");
  await refreshAuthStatus();
  await loadPersistedData();
  await Promise.allSettled([loadModels(), loadVoices(), loadSourceContext()]);
  applyPreferencesToUI();
  renderChatHistory();
  renderActiveChat();
  setStatus("Ready");
}

initializeApp();
