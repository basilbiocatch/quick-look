let userIdentity = {};

export function setIdentity(data) {
  if (data && typeof data === "object") {
    userIdentity = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      ...data,
    };
  }
}

export function getIdentity() {
  return { ...userIdentity };
}
