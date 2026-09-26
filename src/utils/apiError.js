export class ApiError extends Error {
  /**
   * @param {number} status Código HTTP
   * @param {string} message Mensaje legible para el cliente
   */
  constructor(status, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.expose = true;
  }
}