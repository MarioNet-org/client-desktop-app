<script lang="ts">
  import EmailVerification from './EmailVerification.svelte';
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import './dashboard.css';

  let { user, onSignedOut }: { user: User; onSignedOut: () => void } = $props();
  let nodes = $state<MonitorNode[]>([]);
  let presets = $state<MacroPreset[]>([]);
  let selected = $state<string[]>([]);
  let multiControl = $state(false);
  let activeNode = $state<MonitorNode | null>(null);
  let activeId = $state<string | null>(null);
  let locked = $state(false);
  let query = $state('');
  let filter = $state<'all' | 'online' | 'offline'>('all');
  let loading = $state(true);
  let refreshing = $state(false);
  let nodeError = $state('');
  let presetError = $state('');
  let presetLoading = $state(true);
  let lastUpdated = $state<Date | null>(null);
  let signingOut = $state(false);
  let disposed = false;
  let modal = $state<'preset' | 'delete' | 'node' | 'control' | null>(null);
  let dialog = $state<HTMLDialogElement>();
  let editingId = $state<string | undefined>();
  let draftName = $state('');
  let draftIcon = $state<string | null>(null);
  let modalError = $state('');
  let controlMenu = $state(false);
  let controlTrigger: HTMLButtonElement | null = null;
  let saving = $state(false);
  let readingIcon = $state(false);
  let uploadVersion = 0;
  let monitorStreams = $state(new Map<string, MediaStream>());
  let monitorStatus = $state(new Map<string, string>());
  const connections = new Map<string, { id: string; nodeId: string }>();
  const peers = new Map<string, RTCPeerConnection>();
  const pendingIce = new Map<string, RTCIceCandidateInit[]>();
  const visibleNodes = $derived(nodes.filter(node => node.name.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()) && (filter === 'all' || node.online === (filter === 'online'))));
  const onlineCount = $derived(nodes.filter(node => node.online).length);
  const selectedOnline = $derived(nodes.filter(node => selected.includes(node.id) && node.online).length);
  const activePreset = $derived(presets.find(preset => preset.id === activeId));

  async function loadNodes() {
    if (refreshing || disposed) return;
    refreshing = true;
    try {
      const result = await window.marioNet!.listNodes();
      if (disposed) return;
      if (result.ok) { nodes = [...result.nodes].sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true })); nodeError = ''; lastUpdated = new Date(); for (const node of nodes) if (node.online) void startMonitoring(node); }
      else nodeError = result.code === 'RATE_LIMITED' ? '요청이 많아요. 잠시 후 새로고침해주세요.' : 'Node 목록을 불러오지 못했어요. 서버 연결을 확인해주세요.';
    } catch { if (!disposed) nodeError = 'Node 목록을 불러오지 못했어요. 다시 시도해주세요.'; }
    finally { if (!disposed) { loading = false; refreshing = false; } }
  }
  function setStream(nodeId: string, stream: MediaStream | undefined) { const next = new Map(monitorStreams); if (stream) next.set(nodeId, stream); else next.delete(nodeId); monitorStreams = next; }
  function setMonitorStatus(nodeId: string, status: string) { const next = new Map(monitorStatus); next.set(nodeId, status); monitorStatus = next; }
  function streamVideo(element: HTMLVideoElement, stream: MediaStream | undefined) {
    const update = (value: MediaStream | undefined) => { element.srcObject = value ?? null; if (value) void element.play().catch(() => {}); };
    update(stream); return { update, destroy: () => { element.srcObject = null; } };
  }
  async function startMonitoring(node: MonitorNode) {
    if (connections.has(node.id) || !node.online || disposed) return;
    connections.set(node.id, { id: '', nodeId: node.id }); setMonitorStatus(node.id, '화면 연결 요청 중');
    const result = await window.marioNet!.requestConnection(node.id);
    if (!result.ok) { connections.delete(node.id); setMonitorStatus(node.id, '연결 요청 실패'); return; }
    connections.set(node.id, result.connection); setMonitorStatus(node.id, 'Host 승인 대기 중');
  }
  async function handleSignal(signal: { connectionId: string; kind: 'offer' | 'answer' | 'ice'; payload: unknown }) {
    const connection = [...connections.values()].find(value => value.id === signal.connectionId); if (!connection) return;
    if (signal.kind === 'ice') { const peer = peers.get(signal.connectionId); if (!peer?.remoteDescription) pendingIce.set(signal.connectionId, [...(pendingIce.get(signal.connectionId) ?? []), signal.payload as RTCIceCandidateInit]); else await peer.addIceCandidate(signal.payload as RTCIceCandidateInit); return; }
    if (signal.kind !== 'offer') return;
    peers.get(signal.connectionId)?.close();
    const peer = new RTCPeerConnection(); peers.set(signal.connectionId, peer);
    peer.ontrack = event => { if (event.streams[0]) { setStream(connection.nodeId, event.streams[0]); setMonitorStatus(connection.nodeId, '화면 모니터링 중'); } };
    peer.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) { setStream(connection.nodeId, undefined); setMonitorStatus(connection.nodeId, '화면 연결이 끊겼어요'); } };
    peer.onicecandidate = event => { if (event.candidate) void window.marioNet!.sendWebRtcSignal({ connectionId: signal.connectionId, kind: 'ice', payload: event.candidate.toJSON() }); };
    try { await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit); for (const candidate of pendingIce.get(signal.connectionId) ?? []) await peer.addIceCandidate(candidate); pendingIce.delete(signal.connectionId); const answer = await peer.createAnswer(); await peer.setLocalDescription(answer); await window.marioNet!.sendWebRtcSignal({ connectionId: signal.connectionId, kind: 'answer', payload: answer }); }
    catch { setMonitorStatus(connection.nodeId, '화면 협상에 실패했어요'); peer.close(); peers.delete(signal.connectionId); }
  }
  async function loadPresets() {
    presetLoading = true;
    try {
      const result = await window.marioNet!.listPresets();
      if (disposed) return;
      if (result.ok) { presets = result.presets; presetError = ''; activeId ??= presets[0]?.id ?? null; }
      else presetError = '저장된 프리셋을 읽지 못했어요. 다시 불러와주세요.';
    } catch { if (!disposed) presetError = '프리셋을 읽지 못했어요.'; }
    finally { if (!disposed) presetLoading = false; }
  }
  onMount(() => {
    void loadNodes(); void loadPresets();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void loadNodes(); }, 15000);
    const offConnection = window.marioNet!.onConnectionUpdated(connection => { const item = [...connections.values()].find(value => value.id === connection.id || value.nodeId === connection.nodeId); if (!item) return; connections.set(connection.nodeId, connection); if (connection.status === 'ACCEPTED') setMonitorStatus(connection.nodeId, 'Host가 화면을 준비하는 중'); if (['CLOSED', 'REJECTED', 'EXPIRED'].includes(connection.status)) { peers.get(connection.id)?.close(); peers.delete(connection.id); connections.delete(connection.nodeId); setStream(connection.nodeId, undefined); setMonitorStatus(connection.nodeId, '화면 연결 종료'); } });
    const offSignal = window.marioNet!.onWebRtcSignal(signal => { void handleSignal(signal); });
    return () => { disposed = true; uploadVersion++; clearInterval(timer); offConnection(); offSignal(); for (const [id, peer] of peers) { peer.close(); void window.marioNet!.closeConnection(id); } };
  });
  $effect(() => { if (modal && dialog && !dialog.open) dialog.showModal(); else if (!modal && dialog?.open) dialog.close(); });
  function openNode(node: MonitorNode, trigger?: HTMLButtonElement) {
    if (multiControl) { if (!locked) selected = selected.includes(node.id) ? selected.filter(value => value !== node.id) : [...selected, node.id]; }
    else { controlTrigger = trigger ?? null; activeNode = node; modal = 'control'; }
  }
  function selectVisible() { if (!locked) selected = [...new Set([...selected, ...visibleNodes.map(node => node.id)])]; }
  function editPreset(preset?: MacroPreset) {
    editingId = preset?.id; draftName = preset?.name ?? ''; draftIcon = preset?.icon ?? null;
    modalError = ''; modal = 'preset';
  }
  function closeModal() { if (!saving) { controlMenu = false; modal = null; controlTrigger?.blur(); controlTrigger = null; uploadVersion++; readingIcon = false; } }
  async function uploadIcon(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    modalError = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) { modalError = '1MB 이하의 PNG, JPG, WebP 이미지를 선택해주세요.'; return; }
    const version = ++uploadVersion;
    readingIcon = true;
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
      });
      const image = new Image(); image.src = data; await image.decode();
      if (image.naturalWidth > 8192 || image.naturalHeight > 8192) throw new Error('image too large');
      if (version === uploadVersion && !disposed) draftIcon = data;
    } catch { if (version === uploadVersion && !disposed) modalError = '이미지를 읽지 못했어요. 다른 이미지를 선택해주세요.'; }
    finally { if (version === uploadVersion && !disposed) readingIcon = false; }
  }
  async function savePreset(event: SubmitEvent) {
    event.preventDefault();
    if (saving || readingIcon) return;
    if (!draftName.trim()) { modalError = '프리셋 이름을 입력해주세요.'; return; }
    saving = true; modalError = '';
    try {
      const result = await window.marioNet!.savePreset({ id: editingId, name: draftName.trim(), icon: draftIcon });
      if (disposed) return;
      if (result.ok) {
        presets = result.presets; activeId = editingId ?? result.presets.at(-1)?.id ?? null; modal = null;
      } else modalError = result.code === 'PRESET_LIMIT' ? '최대 30개, 전체 아이콘 20MB까지 저장할 수 있어요.' : result.code === 'INVALID_ICON' ? '지원하는 이미지 파일을 다시 선택해주세요.' : '프리셋을 저장하지 못했어요. 다시 시도해주세요.';
    } catch { if (!disposed) modalError = '프리셋을 저장하지 못했어요.'; }
    finally { if (!disposed) saving = false; }
  }
  async function deletePreset() {
    if (!activePreset || saving) return;
    saving = true; modalError = '';
    try {
      const result = await window.marioNet!.deletePreset(activePreset.id);
      if (disposed) return;
      if (result.ok) { presets = result.presets; activeId = presets[0]?.id ?? null; modal = null; }
      else modalError = '프리셋을 삭제하지 못했어요.';
    } catch { if (!disposed) modalError = '프리셋을 삭제하지 못했어요.'; }
    finally { if (!disposed) saving = false; }
  }
  async function signout() {
    if (signingOut) return;
    signingOut = true;
    try { const result = await window.marioNet!.signout(); if (result.ok) onSignedOut(); else nodeError = '잠시 후 다시 로그아웃해주세요.'; }
    catch { nodeError = '로그아웃하지 못했어요. 다시 시도해주세요.'; }
    finally { signingOut = false; }
  }
  function lastSeen(value: string | null) {
    if (!value) return '연결 기록 없음';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '연결 기록 없음' : `마지막 연결 ${date.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  }
</script>

<main class="dashboard" class:multi-mode={multiControl}>
  <section class="monitor-workspace" aria-labelledby="monitor-title">
    <EmailVerification {user} />
    <header class="monitor-header">
      <div><p class="section-kicker">MY WORKSPACE</p><h1 id="monitor-title">노드 관제 <span>{nodes.length}</span></h1><p class="section-description">내 PC들의 상태를 한눈에 확인하세요.</p></div>
      <div class="header-actions"><button class:active={multiControl} class="dash-button" onclick={() => { multiControl = !multiControl; if (!multiControl) selected = []; }}><Icon name="layers" size={16} />동시제어</button><button class="dash-button primary" onclick={() => modal = 'node'}><Icon name="plus" size={16} />Node 추가</button></div>
    </header>
    <div class="monitor-toolbar">
      <div class="node-filters" aria-label="Node 상태 필터">
        <button class:active={filter === 'all'} aria-pressed={filter === 'all'} onclick={() => filter = 'all'}>전체 <span>{nodes.length}</span></button>
        <button class:active={filter === 'online'} aria-pressed={filter === 'online'} onclick={() => filter = 'online'}><i class="status-dot online"></i>온라인 <span>{onlineCount}</span></button>
        <button class:active={filter === 'offline'} aria-pressed={filter === 'offline'} onclick={() => filter = 'offline'}>오프라인 <span>{nodes.length - onlineCount}</span></button>
      </div>
      <div class="toolbar-tools"><div class="node-search"><Icon name="search" size={15} /><input aria-label="Node 이름 검색" bind:value={query} placeholder="Node 검색" /></div><button class="icon-button" aria-label="Node 새로고침" disabled={refreshing} onclick={loadNodes}><span class:refreshing><Icon name="refresh" size={17} /></span></button></div>
    </div>
    <div class="selection-toolbar"><span><Icon name="grid" size={14} />{selected.length}개 선택됨{#if locked}<span class="subtle-lock"><Icon name="lock" size={12} />잠금</span>{/if}</span><div><button disabled={locked || !visibleNodes.length} onclick={selectVisible}>표시된 Node 선택</button><span>·</span><button disabled={locked || !selected.length} onclick={() => selected = []}>선택 해제</button></div></div>
    {#if nodeError}<div class="dash-alert" role="alert"><Icon name="info" size={16} /><span>{nodeError}{#if nodes.length} 이전 목록을 표시 중이에요.{/if}</span><button onclick={loadNodes} disabled={refreshing}>재시도</button></div>{/if}
    <div class="node-area" aria-busy={loading}>
      {#if loading}
        <div class="node-grid skeleton-grid" role="status" aria-label="Node 불러오는 중">{#each [1,2,3,4,5,6] as id}<div class="node-skeleton"><div></div><span></span></div>{/each}</div>
      {:else if nodes.length === 0 && !nodeError}
        <div class="node-empty"><div class="empty-orbit"><Icon name="monitor" size={34} /><span class="orbit-dot"></span></div><p class="section-kicker">YOUR FIRST CONNECTION</p><h2>첫 번째 Node를 연결해보세요</h2><p>Host에서 같은 계정으로 PC를 등록하면<br />이곳에서 모니터링하고 선택할 수 있어요.</p><button class="dash-button primary" onclick={() => modal = 'node'}><Icon name="plus" size={16} />Node 연결 안내</button><span class="empty-note">등록된 PC만 계정에 표시됩니다.</span></div>
      {:else if visibleNodes.length === 0 && !nodeError}
        <div class="node-empty compact"><Icon name="search" size={30} /><h2>조건에 맞는 Node가 없어요</h2><button class="dash-button" onclick={() => { query = ''; filter = 'all'; }}>필터 초기화</button></div>
      {:else}
        <div class="node-grid">
          {#each visibleNodes as node (node.id)}
            <button class="node-card" class:selected={selected.includes(node.id)} aria-pressed={multiControl && selected.includes(node.id)} aria-label={`${node.name} ${multiControl ? '선택' : '제어'}`} onclick={event => openNode(node, event.currentTarget as HTMLButtonElement)}>
              <div class="node-preview"><span class="node-label"><strong>{node.name}</strong><small><i class="status-dot" class:online={node.online}></i>{node.online ? monitorStatus.get(node.id) ?? '연결 대기' : '오프라인'}</small></span><span class="node-check">{#if selected.includes(node.id)}<Icon name="check" size={13} />{/if}</span>{#if monitorStreams.get(node.id)}<video class="node-stream" autoplay muted playsinline use:streamVideo={monitorStreams.get(node.id)}></video>{:else}<Icon name="monitor" size={34} />{/if}</div>
            </button>
          {/each}
          {#if !query && filter === 'all'}<button class="add-node-card" onclick={() => modal = 'node'}><Icon name="plus" size={28} /><span>Node 추가</span></button>{/if}
        </div>
      {/if}
    </div>
    <footer class="monitor-footer"><span><i class="status-dot" class:online={!!lastUpdated && !nodeError}></i>{lastUpdated ? `${lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 업데이트` : '서버에서 목록 확인 중'}</span><span>15초마다 상태 갱신 · 화면 스트리밍 준비 중</span></footer>
  </section>

  {#if multiControl}<aside class="macro-sidebar" aria-label="매크로 작업">
    <div class="macro-heading"><div class="macro-symbol"><Icon name="layers" size={19} /></div><div><h2>매크로 작업</h2><p>함께 움직일 Node를 준비하세요.</p></div></div>
    <section class="selection-panel"><div class="section-label">실행 대상 선택</div><button class="selection-switch" class:locked role="switch" aria-checked={!locked} aria-label="노드 선택 열림" onclick={() => locked = !locked}><Icon name={locked ? 'lock' : 'unlock'} size={18} /><span>{locked ? '노드 선택 잠금' : '노드 선택 열림'}</span><span class="switch-track"><span></span></span></button><p>{locked ? '선택한 Node가 고정되었어요. 다시 열면 변경할 수 있어요.' : '왼쪽에서 Node를 선택한 뒤 잠가주세요.'}</p><div class="target-summary"><strong>{selected.length}<span>개 선택</span></strong><span>온라인 {selectedOnline}개</span></div>{#if selected.length}<div class="target-chips">{#each selected.slice(0,4) as id}<span title={nodes.find(node => node.id === id)?.name}>{nodes.find(node => node.id === id)?.name ?? '등록 해제된 Node'}</span>{/each}{#if selected.length > 4}<span>+{selected.length - 4}</span>{/if}</div>{/if}</section>
    <section class="presets-panel" aria-labelledby="presets-title"><div class="preset-heading"><h3 id="presets-title">프리셋 <span>{presets.length}</span></h3><button class="icon-button" aria-label="프리셋 추가" disabled={presetLoading || !!presetError || presets.length >= 30} onclick={() => editPreset()}><Icon name="plus" size={18} /></button></div>
      {#if presetError}<div class="preset-error" role="alert">{presetError}<button class="text-button" onclick={loadPresets}>다시 불러오기</button></div>
      {:else if presetLoading}<p class="muted">프리셋 불러오는 중…</p>
      {:else if !presets.length}<button class="new-preset" onclick={() => editPreset()}><span><Icon name="plus" size={22} /></span><strong>나만의 프리셋 만들기</strong><small>이름과 아이콘으로 작업을 구분하세요.</small></button>
      {:else}<div class="preset-grid" aria-label="매크로 프리셋 선택">{#each presets as preset (preset.id)}<button class="preset-tile" class:active={preset.id === activeId} aria-pressed={preset.id === activeId} title={preset.name} onclick={() => activeId = preset.id}><span class="preset-art">{#if preset.icon}<img src={preset.icon} alt="" />{:else}{preset.name.slice(0,2)}{/if}</span><span class="preset-name">{preset.name}</span></button>{/each}</div>{/if}
      {#if activePreset}<div class="preset-detail"><div class="preset-detail-heading"><strong>{activePreset.name}</strong><div><button class="icon-button" aria-label="프리셋 수정" onclick={() => editPreset(activePreset)}><Icon name="edit" size={15} /></button><button class="icon-button" aria-label="프리셋 삭제" onclick={() => { modalError = ''; modal = 'delete'; }}><Icon name="trash" size={15} /></button></div></div><div class="macro-empty"><Icon name="layers" size={20} /><p>아직 등록된 동작이 없어요.</p><span>매크로 동작 편집은 준비 중이에요.</span></div></div>{/if}
    </section>
    <div class="macro-bottom"><p><Icon name="info" size={14} />프리셋은 이 PC에 계정별로 저장돼요.</p><button class="run-macro" disabled><Icon name="play" size={15} />매크로 실행 <span>준비 중</span></button><div class="account-bar"><span class="avatar">{user.email.slice(0,1).toUpperCase()}</span><span class="account-email" title={user.email}>{user.email}</span><button class="icon-button" aria-label="로그아웃" disabled={signingOut} onclick={signout}><Icon name="logout" size={17} /></button></div></div>
  </aside>{/if}
</main>

<dialog class="dashboard-dialog control-dialog" class:control-dialog={modal === 'control'} bind:this={dialog} oncancel={event => { if (saving) event.preventDefault(); else closeModal(); }} onclose={closeModal} aria-labelledby="dialog-title">
  {#if modal !== 'control'}<div class="dialog-heading"><h2 id="dialog-title">{modal === 'node' ? 'Node 연결하기' : modal === 'delete' ? '프리셋 삭제' : editingId ? '프리셋 수정' : '새 프리셋'}</h2><button class="icon-button" aria-label="창 닫기" disabled={saving} onclick={closeModal}><Icon name="close" size={19} /></button></div>{/if}
  {#if modal === 'control'}
    {#if activeNode && monitorStreams.get(activeNode.id)}<video class="remote-screen" autoplay muted playsinline use:streamVideo={monitorStreams.get(activeNode.id)}></video>{:else}<div class="control-preview"><Icon name="monitor" size={64} /><span><i class:online={activeNode?.online}></i>{activeNode?.online ? monitorStatus.get(activeNode.id) ?? '화면 연결 대기' : '오프라인'}</span></div>{/if}<button class="control-menu-button" aria-label="모니터 메뉴 열기" aria-expanded={controlMenu} onclick={() => controlMenu = !controlMenu}><Icon name="more" size={22} /></button>{#if controlMenu}<aside class="control-menu" aria-label="모니터 메뉴"><strong>{activeNode?.name}</strong><span>메뉴 항목은 준비 중이에요.</span><button onclick={closeModal}>화면 닫기</button></aside>{/if}
  {:else if modal === 'node'}
    <p class="dialog-copy">제어받을 PC의 Host 앱에서 등록해주세요.</p><ol class="connection-steps"><li><span>1</span><div><strong>Host에서 로그인</strong><p>현재 Client와 같은 계정을 사용하세요.</p></div></li><li><span>2</span><div><strong>PC를 Node로 등록</strong><p>이메일 인증을 완료한 뒤 PC를 등록하세요.</p></div></li><li><span>3</span><div><strong>이곳에서 목록 새로고침</strong><p>등록한 Node가 자동으로 표시됩니다.</p></div></li></ol><div class="dialog-note">Host 앱과 화면 전송 기능은 개발 예정이에요. Client에서 가상의 PC를 등록하지 않습니다.</div><button class="dash-button primary full" onclick={() => { closeModal(); void loadNodes(); }}>목록 새로고침<Icon name="refresh" size={16} /></button>
  {:else if modal === 'delete'}
    <p class="dialog-copy"><strong>{activePreset?.name}</strong> 프리셋을 삭제할까요?<br />선택한 Node와 PC 등록에는 영향을 주지 않아요.</p>{#if modalError}<p class="error" role="alert">{modalError}</p>{/if}<div class="dialog-actions"><button class="dash-button" disabled={saving} onclick={closeModal}>취소</button><button class="dash-button danger" disabled={saving} onclick={deletePreset}>{saving ? '삭제 중…' : '삭제'}</button></div>
  {:else if modal === 'preset'}
    <p class="dialog-copy">게임이나 작업에 어울리는 이름과 아이콘을 지정하세요.</p><form class="preset-form" onsubmit={savePreset}>
      <div class="icon-upload-row"><div class="icon-preview">{#if draftIcon}<img src={draftIcon} alt="선택한 프리셋 아이콘" />{:else}<Icon name="layers" size={30} />{/if}</div><div><label class="upload-button"><Icon name="upload" size={15} />아이콘 업로드<input aria-label="프리셋 아이콘 업로드" type="file" accept="image/png,image/jpeg,image/webp" disabled={saving || readingIcon} onchange={uploadIcon} /></label><p>PNG, JPG, WebP · 최대 1MB</p>{#if draftIcon}<button type="button" class="text-button" disabled={saving || readingIcon} onclick={() => draftIcon = null}>아이콘 제거</button>{/if}</div></div><label for="preset-name">프리셋 이름</label><input id="preset-name" bind:value={draftName} placeholder="예: XX게임, 광클" maxlength="40" required disabled={saving} /><div class="name-count">{draftName.length}/40</div>{#if modalError}<p class="error" role="alert">{modalError}</p>{/if}<div class="dialog-actions"><button class="dash-button" type="button" disabled={saving} onclick={closeModal}>취소</button><button class="dash-button primary" type="submit" disabled={saving || readingIcon}>{saving ? '저장 중…' : readingIcon ? '이미지 읽는 중…' : '저장'}</button></div>
    </form>
  {/if}
</dialog>

