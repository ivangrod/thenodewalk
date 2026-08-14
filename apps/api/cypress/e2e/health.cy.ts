describe('GET /health', () => {
  it('reports that the API is available', () => {
    cy.request('/health').then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.status).to.equal('ok');
      expect(response.body.timestamp).to.match(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
