export function parsedOrigin(value) {
  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}

export function hasExactOrigin(candidateUrl, expectedUrl) {
  const candidateOrigin = parsedOrigin(candidateUrl)
  const expectedOrigin = parsedOrigin(expectedUrl)
  return candidateOrigin !== undefined && expectedOrigin !== undefined && candidateOrigin === expectedOrigin
}
