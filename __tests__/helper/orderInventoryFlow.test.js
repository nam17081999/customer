import { describe, expect, it } from 'vitest'
import {
  buildCancelPurchaseOrderArgs,
  buildCancelSalesOrderArgs,
  buildProductUpdatePayload,
  buildProductUnitPayload,
  addSalesOrderDraft,
  addSalesOrderDraftForStore,
  buildSalesOrderDraftStoragePayload,
  buildSalesOrderInvoiceModel,
  buildPurchaseOrderRpcPayload,
  buildSalesOrderRpcPayload,
  assertSalesOrderStockAvailable,
  buildSalesOrderPaymentQrUrl,
  closeSalesOrderDraft,
  createSalesOrderDraft,
  createSalesOrderLine,
  createMutationRequestId,
  filterInventoryProducts,
  filterSalesOrders,
  filterStockMovements,
  formatProductStock,
  formatVietnameseMoneyInWords,
  getInventoryProductCategories,
  getOrderInventoryWorkbenchClasses,
  getSalesOrderCreateRedirect,
  getSalesOrderStockIssues,
  getSalesOrderPaymentInfo,
  parseSalesOrderDraftStoragePayload,
  summarizeInventoryProducts,
  summarizePurchaseOrders,
  summarizeSalesOrders,
  toInventoryNumber,
  updateSalesOrderDraft,
} from '@/helper/orderInventoryFlow'

describe('orderInventoryFlow purchase payload', () => {
  it('chuẩn hóa phiếu nhập và chỉ giữ dòng hàng hợp lệ', () => {
    expect(buildPurchaseOrderRpcPayload({
      code: ' PN001 ',
      supplierName: '  Nhà cung cấp A ',
      note: ' nhập đầu ngày ',
      createdBy: 'user-1',
      requestId: 'purchase_req_1',
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
      p_request_id: 'purchase_req_1',
    })
  })

  it('chặn phiếu nhập không có dòng hàng hợp lệ', () => {
    expect(() => buildPurchaseOrderRpcPayload({
      code: 'PN002',
      items: [{ productId: 'product-1', productUnitId: 'unit-1', quantity: '0', unitCost: '1000' }],
    })).toThrow('Vui lòng thêm ít nhất một dòng hàng nhập.')
  })

  it('chặn số nhập sai và quy đổi không dương thay vì tự đổi thành 0/1', () => {
    expect(() => buildPurchaseOrderRpcPayload({
      code: 'PN003',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: 'abc', conversionToBaseQty: '12', unitCost: '1000' }],
    })).toThrow('Số lượng không hợp lệ.')

    expect(() => buildPurchaseOrderRpcPayload({
      code: 'PN004',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: '1', conversionToBaseQty: '0', unitCost: '1000' }],
    })).toThrow('Quy đổi phải lớn hơn 0.')
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
      requestId: 'sales_req_1',
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
      p_request_id: 'sales_req_1',
    })
  })

  it('tạo mutation request id ổn định định dạng để dùng idempotency', () => {
    expect(createMutationRequestId('Sales Order')).toMatch(/^salesorder_/)
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

  it('làm tròn tiền 2 số và số lượng/quy đổi an toàn cho RPC numeric', () => {
    const payload = buildSalesOrderRpcPayload({
      customerStoreId: 'store-1',
      discountAmount: '0.015',
      items: [{
        productId: 'p1',
        productUnitId: 'u1',
        quantity: '1.23456',
        conversionToBaseQty: '10.1234567',
        unitPrice: '1000.555',
      }],
    })

    expect(payload.p_order.discount_amount).toBe(0.02)
    expect(payload.p_items[0]).toMatchObject({
      quantity: 1.235,
      conversion_to_base_qty: 10.123457,
      unit_price: 1000.56,
    })
  })

  it('chặn giá bán sai rõ ràng trước khi gọi RPC', () => {
    expect(() => buildSalesOrderRpcPayload({
      customerStoreId: 'store-1',
      items: [{ productId: 'p1', productUnitId: 'u1', quantity: '1', unitPrice: '12x' }],
    })).toThrow('Giá bán không hợp lệ.')
  })

  it('đưa người dùng về danh sách đơn sau khi lưu đơn', () => {
    expect(getSalesOrderCreateRedirect()).toBe('/orders')
  })
})

describe('orderInventoryFlow sales stock guard', () => {
  const productsById = new Map([
    ['p1', { id: 'p1', name: 'Nước suối', base_unit_name: 'chai', onHandBaseQty: 20 }],
    ['p2', { id: 'p2', name: 'Mì gói', base_unit_name: 'gói', onHandBaseQty: 5 }],
  ])

  it('cộng dồn nhiều dòng cùng sản phẩm theo đơn vị gốc', () => {
    expect(getSalesOrderStockIssues([
      { productId: 'p1', quantity: '1', conversionToBaseQty: '12' },
      { productId: 'p1', quantity: '10', conversionToBaseQty: '1' },
      { productId: 'p2', quantity: '2', conversionToBaseQty: '1' },
    ], productsById)).toEqual([
      {
        productId: 'p1',
        productName: 'Nước suối',
        requiredBaseQty: 22,
        onHandBaseQty: 20,
        unitName: 'chai',
        message: 'Nước suối thiếu 2 chai',
      },
    ])
  })

  it('chặn submit khi tồn kho không đủ trước khi gọi RPC', () => {
    expect(() => assertSalesOrderStockAvailable([
      { productId: 'p2', quantity: '6', conversionToBaseQty: '1' },
    ], productsById)).toThrow('Không đủ tồn kho: Mì gói thiếu 1 gói.')

    expect(assertSalesOrderStockAvailable([
      { productId: 'p2', quantity: '5', conversionToBaseQty: '1' },
    ], productsById)).toBe(true)
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

  it('lọc hàng hóa loại bỏ sản phẩm đã có trong đơn đang lên', () => {
    expect(filterInventoryProducts(products, {
      query: '',
      excludeProductIds: ['p1'],
    }).map((product) => product.id)).toEqual(['p2'])

    expect(filterInventoryProducts(products, {
      query: 'lavie',
      excludeProductIds: ['p1'],
    })).toEqual([])
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
      created_at: '2026-05-20T08:00:00.000Z',
    },
    {
      id: 'o2',
      code: 'DH002',
      customer_store_id: 's2',
      status: 'cancelled',
      total_amount: 90000,
      gross_profit_amount: 20000,
      created_at: '2026-04-20T08:00:00.000Z',
    },
    {
      id: 'o3',
      code: 'DH003',
      customer_store_id: 's1',
      status: 'active',
      total_amount: 120000,
      gross_profit_amount: 30000,
      created_at: '2026-04-21T08:00:00.000Z',
    },
    {
      id: 'o4',
      code: 'DH004',
      customer_store_id: 's1',
      status: 'active',
      total_amount: 80000,
      gross_profit_amount: 10000,
      created_at: '2026-05-19T08:00:00.000Z',
      created_by: 'user-2',
    },
  ]

  const storesById = new Map([
    ['s1', { id: 's1', name: 'Tạp Hóa Minh Anh', phone: '0901234567' }],
    ['s2', { id: 's2', name: 'Quán Nước Hà Công', phone: '0911111111' }],
  ])

  it('lọc đơn theo trạng thái và query khách/mã/SĐT', () => {
    expect(filterSalesOrders(orders, storesById, {
      query: 'DH001',
      status: 'active',
    }).map((order) => order.id)).toEqual(['o1'])

    expect(filterSalesOrders(orders, storesById, {
      query: '0911111111',
      status: 'cancelled',
    }).map((order) => order.id)).toEqual(['o2'])
  })

  it('lọc đơn theo nhiều trạng thái checkbox', () => {
    expect(filterSalesOrders(orders, storesById, {
      statuses: ['active'],
    }).map((order) => order.id)).toEqual(['o1', 'o3', 'o4'])

    expect(filterSalesOrders(orders, storesById, {
      statuses: ['cancelled'],
    }).map((order) => order.id)).toEqual(['o2'])

    expect(filterSalesOrders(orders, storesById, {
      statuses: [],
    })).toEqual([])
  })

  it('lọc đơn theo preset tháng hiện tại', () => {
    expect(filterSalesOrders(orders, storesById, {
      datePreset: 'month',
      now: new Date('2026-05-20T12:00:00.000Z'),
    }).map((order) => order.id)).toEqual(['o1', 'o4'])
  })

  it('lọc đơn theo preset ngày, tuần, quý, năm và người tạo', () => {
    const now = new Date('2026-05-20T12:00:00.000Z')

    expect(filterSalesOrders(orders, storesById, { datePreset: 'today', now }).map((order) => order.id)).toEqual(['o1'])
    expect(filterSalesOrders(orders, storesById, { datePreset: 'yesterday', now }).map((order) => order.id)).toEqual(['o4'])
    expect(filterSalesOrders(orders, storesById, { datePreset: 'last7days', now }).map((order) => order.id)).toEqual(['o1', 'o4'])
    expect(filterSalesOrders(orders, storesById, { datePreset: 'quarter', now }).map((order) => order.id)).toEqual(['o1', 'o2', 'o3', 'o4'])
    expect(filterSalesOrders(orders, storesById, { datePreset: 'year', now }).map((order) => order.id)).toEqual(['o1', 'o2', 'o3', 'o4'])
    expect(filterSalesOrders(orders, storesById, { creatorId: 'user-2' }).map((order) => order.id)).toEqual(['o4'])
  })
})

describe('orderInventoryFlow sales order drafts', () => {
  const products = [
    {
      id: 'p1',
      name: 'Nước Lavie',
      default_sale_price: 5000,
      baseUnit: { id: 'u1', unit_name: 'chai', conversion_to_base_qty: 1 },
      units: [
        { id: 'u1', unit_name: 'chai', conversion_to_base_qty: 1 },
        { id: 'u24', unit_name: 'thùng 24', conversion_to_base_qty: 24, default_sale_price: 110000 },
      ],
    },
  ]

  it('tạo dòng bán mặc định ưu tiên đơn vị lớn hơn 1 khi có', () => {
    expect(createSalesOrderLine(products)).toMatchObject({
      productId: 'p1',
      productUnitId: 'u24',
      conversionToBaseQty: 24,
      quantity: '1',
      unitPrice: 110000,
    })
  })

  it('tạo draft đơn rỗng với tên tab và dữ liệu nhập riêng', () => {
    expect(createSalesOrderDraft({ draftNumber: 2, products, code: 'DH002' })).toMatchObject({
      id: 'draft-2',
      draftNumber: 2,
      title: 'Hóa đơn 2',
      code: 'DH002',
      customerStoreId: '',
      customerQuery: '',
      discountAmount: '',
      items: [],
    })
  })

  it('thêm draft mới và chuyển active sang draft vừa tạo', () => {
    const first = createSalesOrderDraft({ draftNumber: 1, products, code: 'DH001' })
    const result = addSalesOrderDraft({
      drafts: [first],
      products,
      buildCode: () => 'DH002',
    })

    expect(result.activeDraftId).toBe('draft-2')
    expect(result.drafts.map((draft) => draft.title)).toEqual(['Hóa đơn 1', 'Hóa đơn 2'])
    expect(result.drafts[1].code).toBe('DH002')
  })

  it('tạo draft mới cho cửa hàng từ flow lên đơn nhanh dù đã có nháp cũ', () => {
    const existing = {
      ...createSalesOrderDraft({ draftNumber: 1, products, code: 'DH001' }),
      customerStoreId: 'store-old',
      customerQuery: 'Cửa hàng cũ',
      items: [createSalesOrderLine(products)],
    }
    const result = addSalesOrderDraftForStore({
      drafts: [existing],
      stores: [
        { id: 'store-old', name: 'Cửa hàng cũ' },
        { id: 'store-new', name: 'Tạp Hóa Mới', ward: 'Xã A', district: 'Huyện B' },
      ],
      queryStoreId: 'store-new',
      products,
      buildCode: () => 'DH002',
    })

    expect(result.created).toBe(true)
    expect(result.activeDraftId).toBe('draft-2')
    expect(result.drafts).toHaveLength(2)
    expect(result.drafts[0]).toEqual(existing)
    expect(result.drafts[1]).toMatchObject({
      id: 'draft-2',
      code: 'DH002',
      customerStoreId: 'store-new',
      customerQuery: 'Tạp Hóa Mới - Xã A - Huyện B',
      items: [],
    })
  })

  it('tạo draft đầu tiên cho cửa hàng nếu chưa có nháp cũ', () => {
    const result = addSalesOrderDraftForStore({
      drafts: [],
      stores: [{ id: 'store-new', name: 'Tạp Hóa Mới', ward: 'Xã A', district: 'Huyện B' }],
      queryStoreId: 'store-new',
      products,
      buildCode: () => 'DH001',
    })

    expect(result).toMatchObject({
      created: true,
      activeDraftId: 'draft-1',
      drafts: [
        {
          id: 'draft-1',
          code: 'DH001',
          customerStoreId: 'store-new',
          customerQuery: 'Tạp Hóa Mới - Xã A - Huyện B',
          items: [],
        },
      ],
    })
  })

  it('không tạo draft nhanh nếu query store không hợp lệ', () => {
    const existing = createSalesOrderDraft({ draftNumber: 1, products, code: 'DH001' })
    const result = addSalesOrderDraftForStore({
      drafts: [existing],
      stores: [{ id: 'store-1', name: 'Tạp Hóa A' }],
      queryStoreId: 'missing',
      products,
      buildCode: () => 'DH002',
    })

    expect(result).toEqual({
      created: false,
      drafts: [existing],
      activeDraftId: existing.id,
    })
  })

  it('cập nhật đúng draft đang sửa và giữ nguyên draft khác', () => {
    const drafts = [
      createSalesOrderDraft({ draftNumber: 1, products, code: 'DH001' }),
      createSalesOrderDraft({ draftNumber: 2, products, code: 'DH002' }),
    ]

    const next = updateSalesOrderDraft(drafts, 'draft-2', { customerStoreId: 'store-2', note: 'giao chiều' })

    expect(next[0].customerStoreId).toBe('')
    expect(next[1]).toMatchObject({ customerStoreId: 'store-2', note: 'giao chiều' })
  })

  it('đóng active draft thì chọn draft kế bên, nhưng không đóng draft cuối cùng', () => {
    const drafts = [
      createSalesOrderDraft({ draftNumber: 1, products, code: 'DH001' }),
      createSalesOrderDraft({ draftNumber: 2, products, code: 'DH002' }),
      createSalesOrderDraft({ draftNumber: 3, products, code: 'DH003' }),
    ]

    const closed = closeSalesOrderDraft({ drafts, activeDraftId: 'draft-2', draftId: 'draft-2' })
    expect(closed.drafts.map((draft) => draft.id)).toEqual(['draft-1', 'draft-3'])
    expect(closed.activeDraftId).toBe('draft-3')

    const single = closeSalesOrderDraft({ drafts: [drafts[0]], activeDraftId: 'draft-1', draftId: 'draft-1' })
    expect(single.drafts).toEqual([drafts[0]])
    expect(single.activeDraftId).toBe('draft-1')
  })

  it('đóng gói nháp để lưu localStorage và khôi phục đúng active draft', () => {
    const drafts = [
      {
        ...createSalesOrderDraft({ draftNumber: 1, products, code: 'DH001' }),
        customerStoreId: 'store-1',
        customerQuery: 'Tạp Hóa Minh Anh',
        note: 'giao chiều',
        discountAmount: '5000',
        items: [
          {
            productId: 'p1',
            productUnitId: 'u24',
            conversionToBaseQty: 24,
            quantity: '2',
            unitPrice: '110000',
            note: 'lạnh',
          },
        ],
      },
      createSalesOrderDraft({ draftNumber: 2, products, code: 'DH002' }),
    ]

    const payload = buildSalesOrderDraftStoragePayload({ drafts, activeDraftId: 'draft-1' })
    expect(payload).toMatchObject({
      version: 1,
      activeDraftId: 'draft-1',
      drafts,
    })

    expect(parseSalesOrderDraftStoragePayload(JSON.stringify(payload))).toEqual(payload)
  })

  it('khôi phục nháp an toàn và bỏ payload lưu hỏng', () => {
    expect(parseSalesOrderDraftStoragePayload('')).toBeNull()
    expect(parseSalesOrderDraftStoragePayload('{')).toBeNull()
    expect(parseSalesOrderDraftStoragePayload(JSON.stringify({ version: 1, drafts: [] }))).toBeNull()
    expect(parseSalesOrderDraftStoragePayload(JSON.stringify({
      version: 1,
      activeDraftId: 'missing',
      drafts: [
        {
          id: 'draft-7',
          draftNumber: '7',
          title: '',
          code: 123,
          customerStoreId: 456,
          customerQuery: null,
          note: 'ghi chú',
          discountAmount: 0,
          items: [
            {
              productId: 'p1',
              productUnitId: 'u1',
              conversionToBaseQty: '12',
              quantity: 2,
              unitPrice: 1000,
              note: null,
            },
            { productId: '', productUnitId: 'u1', quantity: 1 },
          ],
        },
      ],
    }))).toEqual({
      version: 1,
      activeDraftId: 'draft-7',
      drafts: [
        {
          id: 'draft-7',
          draftNumber: 7,
          title: 'Hóa đơn 7',
          code: '123',
          customerStoreId: '456',
          customerQuery: '',
          note: 'ghi chú',
          requestId: expect.stringMatching(/^sales_/),
          discountAmount: '0',
          items: [
            {
              productId: 'p1',
              productUnitId: 'u1',
              conversionToBaseQty: 12,
              quantity: '2',
              unitPrice: '1000',
              costPriceBase: '',
              note: '',
            },
          ],
        },
      ],
    })
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
  it('toInventoryNumber trả fallback cho input rỗng hoặc chỉ có khoảng trắng', () => {
    expect(toInventoryNumber('', 120000)).toBe(120000)
    expect(toInventoryNumber('   ', 24)).toBe(24)
  })

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

describe('orderInventoryFlow invoice payment helpers', () => {
  it('formatVietnameseMoneyInWords đọc tiền nguyên đồng bằng tiếng Việt', () => {
    expect(formatVietnameseMoneyInWords(9170000)).toBe('Chín triệu một trăm bảy mươi nghìn đồng')
    expect(formatVietnameseMoneyInWords(0)).toBe('Không đồng')
  })

  it('trả thông tin thanh toán HDBank cố định cho mẫu in đơn', () => {
    expect(getSalesOrderPaymentInfo()).toEqual({
      bankCode: 'HDB',
      bankName: 'Ngân hàng HD Bank',
      accountNumber: '186704070009441',
    })
  })

  it('buildSalesOrderPaymentQrUrl tạo VietQR theo tổng tiền đơn hàng', () => {
    const url = buildSalesOrderPaymentQrUrl({
      code: 'DH001',
      total_amount: 411000,
    })

    expect(url).toContain('https://img.vietqr.io/image/HDB-186704070009441-compact2.png')
    expect(url).toContain('amount=411000')
    expect(url).toContain('addInfo=DH001')
  })

  it('buildSalesOrderPaymentQrUrl làm tròn amount về số nguyên không âm', () => {
    expect(buildSalesOrderPaymentQrUrl({
      code: 'DH002',
      total_amount: -1000,
    })).toContain('amount=0')

    expect(buildSalesOrderPaymentQrUrl({
      code: 'DH003',
      total_amount: 1234.56,
    })).toContain('amount=1235')
  })

  it('buildSalesOrderInvoiceModel gom dữ liệu in đơn với khách, hàng, đơn vị và QR', () => {
    const model = buildSalesOrderInvoiceModel({
      order: {
        code: 'DH004',
        created_at: '2026-05-17T06:30:00Z',
        subtotal_amount: 500000,
        discount_amount: 10000,
        total_amount: 490000,
        note: 'Giao trong ngày',
      },
      customer: {
        name: 'Tạp Hóa Minh Anh',
        phone: '0901234567',
        address_detail: 'Số 1 Đường A',
        ward: 'Phường B',
        district: 'Quận C',
      },
      items: [
        {
          id: 'i1',
          product_id: 'p1',
          product_unit_id: 'u2',
          quantity: 2,
          conversion_to_base_qty: 24,
          unit_price: 245000,
          line_total: 490000,
        },
      ],
      productsById: new Map([
        ['p1', {
          name: 'Nước Lavie 500ml',
          sku: 'LAVIE500',
          base_unit_name: 'chai',
          units: [
            { id: 'u1', unit_name: 'chai', conversion_to_base_qty: 1 },
            { id: 'u2', unit_name: 'thùng 24', conversion_to_base_qty: 24 },
          ],
        }],
      ]),
    })

    expect(model.customerAddress).toBe('Số 1 Đường A, Phường B, Quận C')
    expect(model.totalAmountInWords).toBe('Bốn trăm chín mươi nghìn đồng')
    expect(model.paymentInfo).toEqual(getSalesOrderPaymentInfo())
    expect(model.paymentQrUrl).toContain('amount=490000')
    expect(model.lines).toEqual([
      {
        id: 'i1',
        productName: 'Nước Lavie 500ml',
        sku: 'LAVIE500',
        unitName: 'thùng 24',
        quantity: 2,
        conversionToBaseQty: 24,
        baseUnitName: 'chai',
        unitPrice: 245000,
        lineTotal: 490000,
      },
    ])
  })
})
