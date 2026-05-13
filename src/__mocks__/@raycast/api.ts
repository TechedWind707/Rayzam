export const open = jest.fn();
export const showHUD = jest.fn();
export const Clipboard = {
  copy: jest.fn(),
};
export const LocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
export const Icon = {};
export const Toast = {
  Style: {
    Animated: "animated",
    Failure: "failure",
    Success: "success",
  },
};
export const showToast = jest.fn();
