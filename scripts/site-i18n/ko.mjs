// Website chrome in ko. Keys mirror en.mjs; anything missing falls back to English.
export const ko = {
  'nav.handbook': '안내서',
  'nav.roadmap': '로드맵',
  'nav.github': 'GitHub',
  'nav.sponsor': '후원',
  'nav.download': '다운로드',

  'foot.license': 'Apache 2.0 라이선스 · <a href="https://github.com/StarleyDev">Starley - Mestre Jedi</a>가 💜 를 담아 만들었어요',
  'foot.credit': 'MyAppDesk의 {upstream}를 포크한 프로젝트이며 MIT 라이선스를 따릅니다.',
  'foot.source': '소스',
  'foot.roadmap': '로드맵',
  'foot.reportIssue': '문제 신고',
  'foot.sponsor': '후원',

  'meta.title': 'GitHuttBr — git의 모든 것을, 한눈에',
  'meta.description':
    '온전히 vibe-coding으로 만든 Git 클라이언트. 무료예요. 그래프, 줄 단위 스테이징, 리베이스, 워크트리, 서브모듈, LFS — 그리고 git이 할 줄은 몰랐던 몇 가지까지.',

  'hero.title': 'git의 모든 것을,<br /><em>한눈에</em>',
  'hero.lede':
    '그래프, 줄 단위 스테이징, 리베이스, 워크트리, 서브모듈, LFS.<br />평범한 것들을 제대로 — 그리고 git이 할 줄은 몰랐던 몇 가지까지.',
  'hero.download': '내 플랫폼용 다운로드',
  'hero.source': '소스 보기',
  'hero.terms': '무료 · Apache 2.0 · v{version}',
  'hero.graphAlt': 'GitHuttBr 커밋 그래프',

  'features.title': 'git이 할 줄은 몰랐던 몇 가지',
  'features.sub':
    '이 가운데 어느 것도 GitHuttBr를 쓸 이유는 아니에요 — 이유는 위의 목록이에요. 이것들이 있는 건 git이 이미 답을 알고 있기 때문이고, GitHuttBr는 그저 물어볼 뿐이에요.',

  'ordinary.title': '무엇이 들어 있나요',
  'ordinary.sub':
    '일부가 아니라, 완전한 클라이언트예요. 전부 만들어져 있고, 문서화돼 있고, 지금 앱 안에 있어요 — 평범한 것들이고, git을 쓴다는 건 대부분 그런 것들이에요.',
  'ordinary.graph': '진짜 레인을 그리는 커밋 그래프, 거대한 히스토리도 화면 단위로',
  'ordinary.staging': '한 줄 단위까지 스테이징',
  'ordinary.conflicts': '어느 쪽이 어느 쪽인지 알려 주는 3분할 충돌 해결기',
  'ordinary.rebase': '끌어서 하는 대화형 리베이스',
  'ordinary.stacks': '연쇄 재적재가 되는 스택 브랜치',
  'ordinary.recovery': 'Reflog, WIP 스냅숏, 안내를 따라가는 bisect',
  'ordinary.prs': 'GitHub, GitLab, Bitbucket, Azure DevOps의 풀 리퀘스트',
  'ordinary.terminal': '내장 터미널 — 진짜 PTY',
  'ordinary.launch': '<code>.vscode/launch.json</code> 에서 바로 실행과 디버그',
  'ordinary.ai': '읽은 줄을 인용하는 선택형 AI',
  'ordinary.themes': '밝고 어두운 기본 테마, 그리고 AI가 만든 테마',
  'ordinary.languages': '안내서까지 전부 번역 — 아랍어와 히브리어는 화면을 좌우로 뒤집어요',

  'download.title': '다운로드',
  'download.sub': '최신 릴리스는 <strong>v{version}</strong> 이에요. 모든 빌드는 CI에서 게시돼요.',
  'download.cli':
    '또는 터미널에서 <code>githuttbr .</code> 로 저장소를 열 수 있어요 — <a href="{cli}">명령줄</a> 을 보세요.',
  'download.macNote': 'Apple silicon &amp; Intel',
  'download.winNote': '설치 프로그램 (x64)',
  'download.linuxNote': 'AppImage · deb',
  'download.forOs': '{os}용 다운로드',

  'handbook.title': '앱에 들어 있는 {pages}쪽짜리 안내서',
  'handbook.sub': '모든 기능을 설명해요 — 앱에서 오프라인으로도, 그리고 바로 여기서도.',

  'sponsor.title': 'GitHuttBr 후원하기',
  'sponsor.body':
    '무료, Apache 2.0, 백엔드 없음, 텔레메트리 없음, 더 팔 것도 없음 — 그러니 살 것이 없어요. 후원은 서명된 macOS 빌드에 필요한 Apple Developer 인증서와 안내서, 그리고 번역에 쓰여요. 버그 신고도 그만큼 값져요.',
  'sponsor.cta': 'GitHub에서 후원하기',

  'doc.titleSuffix': 'GitHuttBr 안내서',
  'doc.filter': '페이지 필터…',
  'doc.filterLabel': '페이지 필터',
  'doc.edit': 'GitHub에서 이 페이지 편집하기',
  'doc.improve': 'GitHub에서 이 번역 개선하기',

  'feature.conflict-radar.title': '충돌 레이더',
  'feature.conflict-radar.body':
    '어느 브랜치가 충돌할지 하나라도 머지하기 <strong>전에</strong> 확인해요. 머지는 객체 데이터베이스 안에서 일어나요 — 체크아웃도, 작업 트리 변경도, 나중에 치울 것도 없어요.',
  'feature.recovery.title': 'WIP 스냅샷',
  'feature.recovery.body':
    '작업 트리 전체를 — 추적되지 않는 파일까지 — 타이머로, 그리고 <strong>모든 파괴적인 동작 직전에</strong> 스냅샷으로 남겨요. 후회되는 버리기도 복원 한 번이면 돌아와요.',
  'feature.commit-edit.title': '아무 커밋이나 편집',
  'feature.commit-edit.body':
    '오타가 3주 전 커밋에 있나요? <strong>옛 커밋 안에서</strong> 파일을 고치세요 — 그 위의 모든 커밋이 다시 적용되고, ref 하나가 움직이기 전에 전체 연쇄를 미리 볼 수 있어요.',
  'feature.ai.title': '내 모델 가져오기',
  'feature.ai.body':
    '여러 AI 계정을 한꺼번에 — 커밋 메시지엔 OpenAI 키, 채팅엔 Claude, 나머지엔 로컬 Ollama. 모델 목록은 각 제공자에게서 실시간으로 오고, 이미 로그인해 둔 CLI가 API 키 대신 동작해요.',
  'feature.semantic-diff.title': '시맨틱 diff',
  'feature.semantic-diff.body':
    '400줄짜리 빨강·초록 벽 대신 <code>startServer</code> → <code>bootServer</code>. 정규식이 아니라 진짜 tree-sitter 파싱이에요.',
  'feature.range-diff.title': '그동안 바뀐 것',
  'feature.range-diff.body':
    '리뷰했던 브랜치를 누가 강제 푸시했어요. 어떤 커밋이 재작성되고, 사라지고, 새로 생겼는지 확인하세요 — 예전 위치는 reflog에서 공짜로 나와요.',
  'feature.repo-chat.title': '저장소 채팅',
  'feature.repo-chat.body':
    '이 저장소에 질문하면 읽은 줄을 인용한 답을 받습니다. 살펴봐야 할 파일과 커밋은 그래프, 파일 트리, 디스크 어디에서든 끌어다 고정하세요.',
  'feature.absorb.title': 'Absorb',
  'feature.absorb.body':
    '리뷰 수정을 스테이징하면, blame이 각 헝크를 그 줄을 만든 커밋으로 <code>fixup!</code> 으로 보내 줘요.',
  'feature.time-machine.title': '타임머신',
  'feature.time-machine.body':
    '슬라이더를 끌면 저장소가 변해 가요. 파일이 나타나고, 옮겨 다니고, 되살아나요. HEAD는 움직이지 않고, 커밋하지 않은 작업도 그대로예요.',
  'feature.timelapse.title': '타임랩스',
  'feature.timelapse.body':
    '저장소의 일생 전체를 애니메이션으로 재생하고, 영상으로 내보내세요. 페이지 안에서 녹화하니 설치할 인코더도 없어요.',
  'feature.pr-preview.title': '풀 리퀘스트 미리 보기',
  'feature.pr-preview.body':
    '남의 PR을 — 포크에서 온 것까지 — 아무것도 커밋하지 않고 돌려 봐요. API 토큰도, 두 번째 원격도 필요 없어요. 헤드는 포지가 이미 공개해 둔 ref에서 가져오고, GitHub, GitLab, Bitbucket, Azure DevOps, Gitea 모두 돼요.',
  'feature.mission-control.title': '미션 컨트롤',
  'feature.mission-control.body':
    '작업 공간의 모든 저장소를 한 화면에, 손이 필요한 순서대로 늘어놓아요. 막힌 것 먼저, 그다음 동기화할 것, 그다음 작업 중인 것, 마지막으로 조용한 것.',
  'feature.attributes.title': 'UI가 붙은 파일 속성',
  'feature.attributes.body':
    'git에서 가장 쓸모 있으면서도 아무도 쓰지 않는 파일이에요. 줄바꿈 문자를 모두를 위해 한 번에 정하고, 변경 기록이 더는 충돌하지 않게 하고, 픽스처를 릴리스 아카이브에서 빼고 — 변환기가 설치돼 있다면 Word와 PDF의 읽을 수 있는 diff까지요.',
  'feature.languages.title': '아마 여러분의 언어도',
  'feature.languages.body':
    '버튼만 대충 옮긴 번역이 아니라, 설명까지 포함한 인터페이스 전체예요. 아랍어와 히브리어는 화면을 좌우로 뒤집고, 그래프와 diff, 경로, 터미널은 왼쪽에서 오른쪽 그대로예요. 코드가 읽히는 방향이 그쪽이니까요.',
  'feature.security.title': '여러분의 비밀은 여러분의 것',
  'feature.security.body':
    '백엔드가 없어요. 토큰과 금고 항목은 OS 키체인으로 암호화되고 — 무엇을 위한 것인지 듣고 여러분이 그러겠다고 하기 전까지는 그 키체인에 아무것도 손대지 않아요.',
  'feature.cli.title': '진짜 CLI를 갖춘 Git GUI',
  'feature.cli.body':
    '`githuttbr .`는 저장소를 열고, `githuttbr blame src/api.ts -l 84`는 해당 줄에서 엽니다. `githuttbr doctor`는 창을 전혀 열지 않고 저장소의 요구 사항을 검사한 뒤 CI가 읽을 수 있는 종료 코드를 반환합니다.',
  'feature.hosting.title': '어떤 서버에서든 풀 리퀘스트',
  'feature.hosting.body':
    'GitHub, GitLab, Bitbucket, Azure DevOps, Forgejo에서 만들고 리뷰하고 병합하세요. 회사 자체의 GitHub Enterprise, GitLab, Bitbucket Data Center 서버에서도 되며, 리뷰어·담당자·라벨은 저장소에서 바로 고릅니다.',

  // The landing page: stats, showcase, security, disclaimer, downloads.
  'nav.language': '언어',
  'stat.platforms': '개 플랫폼 — macOS, Windows, Linux',
  'stat.languages': '개 언어, 핸드북까지',
  'stat.pages': '쪽 분량의 핸드북이 앱 안에',
  'stat.servers': '중간에 끼는 우리 서버',
  'showcase.more': '핸드북 페이지 읽기',
  'more.title': '그리고 더 — 이미 만들어지고, 문서화되어, 오늘 앱에 들어 있습니다',
  'hosts.title': '사용하는 호스트와 함께 작동합니다',
  'hosts.beta': '베타',
  'ai.compatible': '호환되는 모든 엔드포인트',
  'sec.keychain.title': '키체인 전에 먼저 묻습니다',
  'sec.keychain.body': '토큰은 OS 키체인으로 암호화되며, 앱은 키체인을 사용하기 전에 먼저 묻습니다. 거절해도 앱은 계속 작동합니다.',
  'sec.server.title': '토큰 하나, 서버 하나',
  'sec.server.body': 'github.com, Enterprise, GitLab, Data Center 토큰은 저장할 때 지정한 서버로만 전송됩니다.',
  'sec.plain.title': 'git은 토큰을 평문으로 보지 않습니다',
  'sec.plain.body':
    '토큰은 작업마다 따로 열리는 비공개 엔드포인트로 git에 전달됩니다. <code>.git/config</code>도, 명령줄도, 환경 변수도 거치지 않습니다.',
  'sec.confirm.title': '파괴적인 작업은 반드시 확인',
  'sec.confirm.body': '강제 푸시, 변경 취소, 하드 리셋: 확인 창은 무엇을 잃는지 정확히 알려 주고, 그 전에 스냅샷을 남깁니다.',
  'themes.title': '테마, 단축키, 프로필 — 그리고 카피바라',
  'themes.body':
    '라이트·다크 테마와 AI로 만든 테마까지. 신원마다 프로필을 두고 저장소별로 연결합니다. <code>launch.json</code>에서 실행하고 디버그하며, <code>tsc</code>, ESLint, Clippy의 결과를 하단 패널에서 확인하세요.',
  'honest.title': '솔직한 안내',
  'honest.body':
    'GitHuttBr는 아직 젊습니다. 가장 많이 검증된 경로는 <strong>GitHub</strong>입니다. GitHub Enterprise Server, 자체 관리형 GitLab, Bitbucket Data Center는 <strong>베타</strong>로, 모의 서버에서는 테스트했지만 실제 서버에서는 아직입니다. 문제가 생기면 — 글쎄요, <em>제 컴퓨터에서는 잘 됩니다</em>. 이슈와 PR 환영합니다. 💜',
  'download.yours': '내 시스템',
  'download.macHint':
    '아직 서명되지 않았습니다. 처음 실행할 때 <strong>시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기</strong>를 누르세요. Mac에서는 새 버전을 매번 직접 내려받아야 합니다.',
  'download.autoUpdate': '새 릴리스가 나올 때마다 스스로 업데이트됩니다.'
}
