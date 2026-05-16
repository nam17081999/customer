import { describe, expect, it } from 'vitest'
import {
  buildCancelPurchaseOrderArgs,
  buildCancelSalesOrderArgs,
  buildProductUpdatePayload,
  buildProductUnitPayload,
  buildPurchaseOrderRpcPayload,
  buildSalesOrderRpcPayload,
  filterInventoryProducts,
  filterSalesOrders,
  filterStockMovements,
  formatProductStock,
  getInventoryProductCategories,
  getOrderInventoryWorkbenchClasses,
  getSalesOrderCreateRedirect,
  summarizeInventoryProducts,
  summarizePurchaseOrders,
  summarizeSalesOrders,
} from '@/helper/orderInventoryFlow'

describe('orderInventoryFlow purchase payload', () => {
  it('chuẩn hóa phiếu nhập và chỉ giữ dòng hàng hợp lệ', () => {
    expect(buildPurchaseOrderRpcPayload({
      code: ' PN001 ',
      supplierName: '  Nhà cung cấp A ',
      note: ' nhập đầu ngày ',
      createdBy: 'user-1',
      items: [
        {
          productId: 'product-1',
          productUnitId: 'unit-1',
          quantity: '2',
          conversionToBaseQty: '12',
          unitCost: '120000',
          note: 'thùng 12',
        },
        {
          productId: '',
          productUnitId: 'unit-2',
          quantity: '3',
          unitCost: '1',
        },
      ],
    })).toEqual({
      p_order: {
        code: 'PN001',
        supplier_name: 'Nhà cung cấp A',
        note: 'nhập đầu ngày',
        created_by: 'user-1',
      },
      p_items: [
        {
          product_id: 'product-1',
          product_unit_id: 'unit-1',
          quantity: 2,
          conversion_to_base_qty: 12,
          unit_cost: 120000,
          note: 'thùng 12',
        },
      ],
    })
  })

  it('chặn phiếu nhập không có dòng hàng hợp lệ', () => {
    expect(() => buildPurchaseOrderRpcPayload({
      code: 'PN002',
      items: [{ productId: 'product-1', productUnitId: 'unit-1', quantity: '0', unitCost: '1000' }],
    })).toThrow('Vui lòng thêm ít nhất một dòng hàng nhập.')
  })
})

describe('orderInventoryFlow sales payload', () => {
  it('chuẩn hóa đơn bán, tính tổng và snapshot dòng hàng', () => {
    expect(buildSalesOrderRpcPayload({
      code: ' DH001 ',
      customerStoreId: 'store-1',
      note: ' giao chiều ',
      discountAmount: '5000',
      createdBy: 'user-1',
      items: [
        {
          productId: 'product-1',
          productUnitId: 'unit-1',
          quantity: '3',
          conversionToBaseQty: '24',
          unitPrice: '240000',
          note: '3 thùng',
        },
      ],
    })).toEqual({
      p_order: {
        code: 'DH001',
        customer_store_id: 'store-1',
        note: 'giao chiều',
        discount_amount: 5000,
        created_by: 'user-1',
      },
      p_items: [
        {
          product_id: 'product-1',
          product_unit_id: 'unit-1',
          quantity: 3,
          conversion_to_base_qty: 24,
          unit_price: 240000,
          note: '3 thùng',
        },
      ],
    })
  })

  it('chặn đơn bán thiếu khách hoặc giảm giá lớn hơn tạm tính', () => {
    expect(() => buildSalesOrderRpcPayload({
      customerStoreId: '',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: '1', unitPrice: '1000' }],
    })).toThrow('Vui lòng chọn khách hàng.')

    expect(() => buildSalesOrderRpcPayload({
      customerStoreId: 'store-1',
      discountAmount: '2000',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: '1', unitPrice: '1000' }],
    })).toThrow('Giảm giá không được lớn hơn tạm tính.')
  })

  it('đưa người dùng về danh sách đơn sau khi lưu đơn', () => {
    expect(getSalesOrderCreateRedirect()).toBe('/orders')
  })
})

describe('orderInventoryFlow cancel and summary', () => {
  it('build args hủy đơn/phiếu nhập đúng tên RPC', () => {
    expect(buildCancelSalesOrderArgs('order-1', 'user-1')).toEqual({
      p_order_id: 'order-1',
      p_cancelled_by: 'user-1',
    })

    expect(buildCancelPurchaseOrderArgs('purchase-1', null)).toEqual({
      p_purchase_order_id: 'purchase-1',
      p_cancelled_by: null,
    })
  })

  it('summary không cộng doanh thu/lãi của đơn đã hủy', () => {
    expect(summarizeSalesOrders([
      { total_amount: 100000, gross_profit_amount: 20000, status: 'active' },
      { total_amount: 50000, gross_profit_amount: 10000, status: 'cancelled' },
    ])).toEqual({
      totalOrders: 2,
      activeOrders: 1,
      totalAmount: 100000,
      totalProfit: 20000,
      cancelled: 1,
    })
  })
})

describe('orderInventoryFlow product UI helpers', () => {
  const products = [
    {
      id: 'p1',
      name: 'Nước Lavie 500ml',
      sku: 'LAVIE500',
      category: 'Nước',
      base_unit_name: 'chai',
      min_stock_base_qty: 24,
      onHandBaseQty: 18,
      avgCostPerBaseUnit: 3000,
      active: true,
      units: [
        { unit_name: 'chai', conversion_to_base_qty: 1, is_base_unit: true },
        { unit_name: 'thùng 24', conversion_to_base_qty: 24, is_base_unit: false },
      ],
    },
    {
      id: 'p2',
      name: 'Bia Hà Nội Lon',
      sku: 'BIAHN',
      category: 'Bia',
      base_unit_name: 'lon',
      min_stock_base_qty: 12,
      onHandBaseQty: 48,
      avgCostPerBaseUnit: 8000,
      active: true,
      units: [
        { unit_name: 'lon', conversion_to_base_qty: 1, is_base_unit: true },
        { unit_name: 'thùng 24', conversion_to_base_qty: 24, is_base_unit: false },
      ],
    },
  ]

  it('lọc hàng hóa theo query tiếng Việt không dấu, nhóm và trạng thái tồn thấp', () => {
    expect(filterInventoryProducts(products, {
      query: 'nuoc lavie',
      category: 'Nước',
      stockFilter: 'low',
    }).map((product) => product.id)).toEqual(['p1'])
  })

  it('summary hàng hóa dùng toàn bộ danh sách, gồm giá trị tồn và số tồn thấp', () => {
    expect(summarizeInventoryProducts(products)).toEqual({
      total: 2,
      active: 2,
      lowStock: 1,
      outOfStock: 0,
      stockValue: 438000,
    })
  })

  it('định dạng tồn theo thùng lớn nhất và phần lẻ', () => {
    expect(formatProductStock(products[0])).toBe('0 thùng 24 18 chai')
    expect(formatProductStock(products[1])).toBe('2 thùng 24')
  })

  it('lấy danh sách nhóm hàng duy nhất theo alphabet tiếng Việt', () => {
    expect(getInventoryProductCategories(products)).toEqual(['Bia', 'Nước'])
  })
})

describe('orderInventoryFlow order UI helpers', () => {
  const orders = [
    {
      id: 'o1',
      code: 'DH001',
      customer_store_id: 's1',
      status: 'active',
      total_amount: 100000,
      gross_profit_amount: 25000,
    },
    {
      id: 'o2',
      code: 'DH002',
      customer_store_id: 's2',
      status: 'cancelled',
      total_amount: 90000,
      gross_profit_amount: 20000,
    },
  ]

  const storesById = new Map([
    ['s1', { id: 's1', name: 'Tạp Hóa Minh Anh', phone: '0901234567' }],
    ['s2', { id: 's2', name: 'Quán Nước Hà Công', phone: '0911111111' }],
  ])

  it('lọc đơn theo trạng thái và query khách/mã/SĐT', () => {
    expect(filterSalesOrders(orders, storesById, {
      query: 'minh anh',
      status: 'active',
    }).map((order) => order.id)).toEqual(['o1'])

    expect(filterSalesOrders(orders, storesById, {
      query: '0911111111',
      status: 'cancelled',
    }).map((order) => order.id)).toEqual(['o2'])
  })
})

describe('orderInventoryFlow wide workbench classes', () => {
  it('khóa shell theo max width 1900px và padding riêng cho màn rất rộng', () => {
    const classes = getOrderInventoryWorkbenchClasses()
    expect(classes.shell).toContain('max-w-[1900px]')
    expect(classes.shell).toContain('min-[1900px]:px-8')
  })

  it('có grid riêng cho product/order/purchase ở breakpoint min-width 1900px', () => {
    const classes = getOrderInventoryWorkbenchClasses()
    expect(classes.productsGrid).toContain('min-[1900px]:grid-cols-[420px_1fr]')
    expect(classes.orderFormGrid).toContain('min-[1900px]:grid-cols-[460px_1fr]')
    expect(classes.purchaseGrid).toContain('min-[1900px]:grid-cols-[1.7fr_1fr_0.7fr_1fr_1fr_52px]')
    expect(classes.orderListGrid).toContain('min-[1900px]:grid-cols-[0.8fr_1.8fr_1fr_0.8fr_0.8fr_0.7fr_0.7fr]')
  })
})

describe('orderInventoryFlow completion helpers', () => {
  it('buildProductUpdatePayload chuẩn hóa field sửa hàng hóa', () => {
    expect(buildProductUpdatePayload({
      name: ' nước lavie 500ml ',
      sku: ' lavie500 ',
      category: ' Nước ',
      defaultSalePrice: '5000',
      defaultPurchasePrice: '',
      minStockBaseQty: '24',
      active: false,
      note: ' tạm ngừng ',
    })).toEqual({
      name: 'Nước Lavie 500ml',
      sku: 'lavie500',
      category: 'Nước',
      default_sale_price: 5000,
      default_purchase_price: null,
      min_stock_base_qty: 24,
      active: false,
      note: 'tạm ngừng',
    })
  })

  it('buildProductUpdatePayload chặn tên rỗng và số âm', () => {
    expect(() => buildProductUpdatePayload({ name: '' })).toThrow('Vui lòng nhập tên hàng hóa.')
    expect(() => buildProductUpdatePayload({ name: 'A', defaultSalePrice: '-1' })).toThrow('Giá bán không được âm.')
  })

  it('summarizePurchaseOrders bỏ phiếu đã hủy khỏi tổng nhập hiệu lực', () => {
    expect(summarizePurchaseOrders([
      { total_amount: 100000, cancelled_at: null },
      { total_amount: 50000, cancelled_at: '2026-05-16T00:00:00Z' },
    ])).toEqual({
      totalOrders: 2,
      activeOrders: 1,
      cancelled: 1,
      totalAmount: 100000,
    })
  })

  it('filterStockMovements lọc theo loại phát sinh và tên hàng không dấu', () => {
    const rows = [
      { id: 'm1', movement_type: 'purchase', product: { name: 'Nước Lavie' } },
      { id: 'm2', movement_type: 'sale', product: { name: 'Bia Hà Nội' } },
    ]

    expect(filterStockMovements(rows, { query: 'nuoc', type: 'purchase' }).map((row) => row.id)).toEqual(['m1'])
  })
})

describe('orderInventoryFlow product unit helpers', () => {
  it('buildProductUnitPayload chuẩn hóa đơn vị quy đổi thường', () => {
    expect(buildProductUnitPayload({
      unitName: ' Thùng 24 ',
      conversionToBaseQty: '24',
      defaultSalePrice: '120000',
      defaultPurchasePrice: '',
      active: true,
      isBaseUnit: false,
    })).toEqual({
      unit_name: 'thùng 24',
      conversion_to_base_qty: 24,
      default_sale_price: 120000,
      default_purchase_price: null,
      active: true,
      is_base_unit: false,
    })
  })

  it('buildProductUnitPayload giữ base unit conversion = 1 và không cho tắt base unit', () => {
    expect(buildProductUnitPayload({
      unitName: 'chai',
      conversionToBaseQty: '24',
      active: true,
      isBaseUnit: true,
    })).toMatchObject({
      unit_name: 'chai',
      conversion_to_base_qty: 1,
      active: true,
      is_base_unit: true,
    })

    expect(() => buildProductUnitPayload({
      unitName: 'chai',
      conversionToBaseQty: '1',
      active: false,
      isBaseUnit: true,
    })).toThrow('Không được tắt đơn vị gốc.')
  })

  it('buildProductUnitPayload chặn tên rỗng, quy đổi không dương, giá âm', () => {
    expect(() => buildProductUnitPayload({ unitName: '', conversionToBaseQty: '1' })).toThrow('Vui lòng nhập tên đơn vị.')
    expect(() => buildProductUnitPayload({ unitName: 'thùng', conversionToBaseQty: '0' })).toThrow('Quy đổi phải lớn hơn 0.')
    expect(() => buildProductUnitPayload({ unitName: 'thùng', conversionToBaseQty: '24', defaultSalePrice: '-1' })).toThrow('Giá bán không được âm.')
  })
})
