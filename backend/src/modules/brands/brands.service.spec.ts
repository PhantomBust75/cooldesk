/// <reference types="jest" />
import { BrandsService } from './brands.service';

describe('BrandsService.listBrands', () => {
  it('should include installation_charge in SELECT', async () => {
    const mockDb = {
      query: jest.fn().mockResolvedValue({
        rows: [{ id: '1', name: 'TestBrand', color_hex: '#ff0000', installation_charge: '250.00', is_active: true, created_at: '2024-01-01' }],
        rowCount: 1,
      }),
    };
    const service = new BrandsService(mockDb as any);
    const result = await service.listBrands({ organizationId: 'org-1' } as any);
    const calledSql: string = mockDb.query.mock.calls[0][0];
    expect(calledSql).toContain('installation_charge');
    expect(result[0]).toHaveProperty('installation_charge', 250);
  });
});
