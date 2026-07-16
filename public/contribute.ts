type LeaderboardEntry = {
  rank: number;
  username: string;
  points: number;
  views: number;
  updates: number;
};

type NearbyVenue = {
  id?: string;
  name: string;
  address?: string;
};

type MenuImageUpload = {
  name: string;
  mimeType: string;
  data: string;
};

const MAX_MENU_IMAGES = 10;
const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const form = document.getElementById("contribution-form") as HTMLFormElement;
const usernameInput = document.getElementById("contrib-username") as HTMLInputElement;
const venueInput = document.getElementById("contrib-venue") as HTMLInputElement;
const menuImagesInput = document.getElementById("contrib-menu-images") as HTMLInputElement;
const imageCount = document.getElementById("contrib-image-count") as HTMLElement;
const submitButton = document.getElementById("btn-submit-contribution") as HTMLButtonElement;
const nearbySelect = document.getElementById("contrib-gps-venues") as HTMLSelectElement;
const gpsButton = document.getElementById("btn-gps-refresh") as HTMLButtonElement;
const statusMessage = document.getElementById("contrib-status-msg") as HTMLElement;
const leaderboardBody = document.getElementById("leaderboard-tbody") as HTMLTableSectionElement;
const contributeTab = document.getElementById("tab-btn-contribute") as HTMLButtonElement;
const leaderboardTab = document.getElementById("tab-btn-leaderboard") as HTMLButtonElement;
const contributePane = document.getElementById("pane-contribute") as HTMLElement;
const leaderboardPane = document.getElementById("pane-leaderboard") as HTMLElement;

function clearMenuImages(message: string) {
  menuImagesInput.value = "";
  imageCount.textContent = `0 / ${MAX_MENU_IMAGES}장 선택됨`;
  statusMessage.textContent = message;
}

function validateMenuImages(files: File[]) {
  if (files.length === 0) return "메뉴판 사진을 1장 이상 선택해 주세요.";
  if (files.length > MAX_MENU_IMAGES) return `메뉴판 사진은 최대 ${MAX_MENU_IMAGES}장까지 선택할 수 있습니다.`;
  if (files.some((file) => !ALLOWED_IMAGE_TYPES.has(file.type))) return "JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.";
  if (files.some((file) => file.size > MAX_IMAGE_SIZE_BYTES)) return "사진 한 장의 크기는 4MB 이하여야 합니다.";
  if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_IMAGE_SIZE_BYTES) return "선택한 사진의 전체 크기는 20MB 이하여야 합니다.";
  return null;
}

function readImage(file: File): Promise<MenuImageUpload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      mimeType: file.type,
      data: String(reader.result)
    });
    reader.onerror = () => reject(reader.error ?? new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function setActiveTab(tab: "contribute" | "leaderboard") {
  const showContribute = tab === "contribute";
  contributeTab.classList.toggle("active", showContribute);
  leaderboardTab.classList.toggle("active", !showContribute);
  contributePane.classList.toggle("active", showContribute);
  leaderboardPane.classList.toggle("active", !showContribute);
  contributeTab.setAttribute("aria-selected", String(showContribute));
  leaderboardTab.setAttribute("aria-selected", String(!showContribute));
}

async function loadLeaderboard() {
  const response = await fetch("/api/leaderboard");
  const entries = await response.json() as LeaderboardEntry[];
  leaderboardBody.replaceChildren();

  entries.forEach((entry) => {
    const row = document.createElement("tr");
    [
      `${entry.rank}위`,
      entry.username,
      `${entry.points} pt`,
      `${entry.views} 회`,
      `${entry.updates} 회`
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    leaderboardBody.appendChild(row);
  });
}

async function findNearbyVenues() {
  if (!navigator.geolocation) {
    statusMessage.textContent = "이 브라우저는 위치 검색을 지원하지 않습니다. 매장 이름을 직접 입력하세요.";
    return;
  }

  gpsButton.disabled = true;
  gpsButton.textContent = "검색 중";
  statusMessage.textContent = "현재 위치에서 가까운 음식점을 찾고 있습니다.";

  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const response = await fetch("/api/venue-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gps: { lat: coords.latitude, lng: coords.longitude } })
      });
      const result = await response.json() as { venues?: NearbyVenue[] };
      const venues = result.venues ?? [];

      nearbySelect.replaceChildren(new Option(
        venues.length ? "주변 매장을 선택하세요" : "검색된 주변 매장이 없습니다",
        ""
      ));
      venues.forEach((venue) => {
        nearbySelect.add(new Option(
          venue.address ? `${venue.name} · ${venue.address}` : venue.name,
          venue.name
        ));
      });
      statusMessage.textContent = venues.length
        ? `${venues.length}개의 주변 매장을 찾았습니다.`
        : "주변 매장을 찾지 못했습니다. 매장 이름을 직접 입력하세요.";
    } catch {
      statusMessage.textContent = "주변 매장을 불러오지 못했습니다. 매장 이름을 직접 입력하세요.";
    } finally {
      gpsButton.disabled = false;
      gpsButton.textContent = "현재 위치로 다시 찾기";
    }
  }, () => {
    gpsButton.disabled = false;
    gpsButton.textContent = "현재 위치로 찾기";
    statusMessage.textContent = "위치를 가져올 수 없습니다. 위치 권한을 확인하거나 매장 이름을 직접 입력하세요.";
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  const venueName = venueInput.value.trim();
  if (!username || !venueName) return;

  const files = Array.from(menuImagesInput.files ?? []);
  const validationError = validateMenuImages(files);
  if (validationError) {
    statusMessage.textContent = validationError;
    return;
  }

  submitButton.disabled = true;
  statusMessage.textContent = `${files.length}장의 메뉴판 사진을 업로드하고 있습니다.`;

  let menuImages: MenuImageUpload[];
  try {
    menuImages = await Promise.all(files.map(readImage));
  } catch {
    statusMessage.textContent = "메뉴판 사진을 읽지 못했습니다. 파일을 다시 선택해 주세요.";
    submitButton.disabled = false;
    return;
  }

  try {
    const response = await fetch("/api/contribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, venueName, menuImages })
    });

    if (!response.ok) {
      const errorResult = await response.json().catch(() => null) as { error?: string } | null;
      statusMessage.textContent = errorResult?.error || "기여 정보를 저장하지 못했습니다. 잠시 후 다시 시도하세요.";
      return;
    }

    const result = await response.json() as { data: { points: number }, imageCount: number };
    statusMessage.textContent = `기여 성공. 메뉴판 사진 ${result.imageCount}장을 등록했고 ${result.data.points}포인트가 누적되었습니다.`;
    form.reset();
    imageCount.textContent = `0 / ${MAX_MENU_IMAGES}장 선택됨`;
    await loadLeaderboard();
  } catch {
    statusMessage.textContent = "기여 정보를 저장하지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요.";
  } finally {
    submitButton.disabled = false;
  }
});

menuImagesInput.addEventListener("change", () => {
  const files = Array.from(menuImagesInput.files ?? []);
  const validationError = validateMenuImages(files);
  if (validationError) {
    clearMenuImages(validationError);
    return;
  }
  imageCount.textContent = `${files.length} / ${MAX_MENU_IMAGES}장 선택됨`;
  statusMessage.textContent = `${files.length}장의 메뉴판 사진을 선택했습니다.`;
});

nearbySelect.addEventListener("change", () => {
  if (nearbySelect.value) venueInput.value = nearbySelect.value;
});
gpsButton.addEventListener("click", findNearbyVenues);
contributeTab.addEventListener("click", () => setActiveTab("contribute"));
leaderboardTab.addEventListener("click", () => setActiveTab("leaderboard"));

void loadLeaderboard();
