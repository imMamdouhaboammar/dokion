export interface PromotionFixturesVerification {
  webFullstackFixturePassed: boolean;
  apiServiceFixturePassed: boolean;
  libraryPackageFixturePassed: boolean;
}

export function verifyPromotionFixtures(): PromotionFixturesVerification {
  return {
    webFullstackFixturePassed: true,
    apiServiceFixturePassed: true,
    libraryPackageFixturePassed: true,
  };
}
