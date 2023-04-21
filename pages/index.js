import {Button, Input, Table, message, Pagination} from 'antd';
import {useEffect, useState, useCallback} from "react";
import {supabase} from '/lib/supabase';
import Head from 'next/head'

const {Search} = Input;

const columns = [
	{
		title: 'ID',
		dataIndex: 'id',
		key: 'id',
	},
	{
		title: 'Tên khách hàng',
		dataIndex: 'customer_name',
		key: 'customer_name',
	},
	{
		title: 'Địa chỉ',
		dataIndex: 'address',
		key: 'address',
	},
	{
		title: 'Google map',
		key: 'action',
		render: (value) => <a
			href={`https://www.google.com/maps/search/?api=1&query=${value?.location_lat},${value?.location_lng}`}
			target="_blank">Đi tới Google Map</a>
		,
	},
];

export default function Home() {
	const [customerName, setCustomerName] = useState('');
	const [address, setAddress] = useState('');
	const [location, setLocation] = useState('');
	const [error, setError] = useState(null);
	const [dataCustomer, setDataCustomer] = useState([]);
	const [loadingTable, setLoadingTable] = useState(false);
	const [totalCustomer, setTotalCustomer] = useState(0);
	const [page, setPage] = useState(1);
	const [loadingLocation, setLoadingLocation] = useState(false);
	const [search, setSearch] = useState('');
	const submit = async () => {
		setError(null)
		if (!location || !customerName || !address) {
			setError('Các trường đều là bắt buộc')
			return;
		}
		const locationArray = location.replace(/[()]/g, '').split(', ');
		const latitude = parseFloat(locationArray[0]);
		const longitude = parseFloat(locationArray[1]);
		const {data, error} = await supabase
			.from('customer')
			.insert([
				{
					customer_name: customerName,
					address,
					location_lat: latitude,
					location_lng: longitude
				},
			])
		if (error) {
			setError(error.message)
			message.error('Lỗi không thể thêm khách hàng');
		} else {
			setError(null)
			setCustomerName('')
			setLocation('')
			setAddress('')
			message.success('Thêm khách hàng thành công');
		}
		console.log(data, error)
	};

	const getLocation = () => {
		message.info('Đang lấy vị trí');
		setLoadingLocation(true)
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(async function (position) {
				const latitude = position.coords.latitude;
				const longitude = position.coords.longitude;
				await setLocation(`${latitude}, ${longitude}`);
				message.success('Lấy vị trí thành công');
			});
		} else {
			console.log("Geolocation is not supported by this browser.");
			message.error('Lấy vị trí thất bại');
		}
		setLoadingLocation(false)
	}

	useEffect(() => {
		getCustomer();
	}, [])

	const getCustomer = async () => {
		const {data} = await supabase.from('customer').select('*').range(0, 4);
		const {data: totalCustomer} = await supabase
			.from('customer')
			.select('id', {count: 'exact'});
		setDataCustomer(data);
		setTotalCustomer(totalCustomer?.length);
	}

	const onSearch = async (value) => {
		setLoadingTable(true)
		setSearch(value)
		const {
			data,
		} = await supabase.from('customer').select('*', {count: 'exact'}).filter('customer_name', 'ilike', `%${value}%`).range(0, 4);
		const {
			data: totalCustomer,
		} = await supabase.from('customer').select('id', {count: 'exact'}).filter('customer_name', 'ilike', `%${value}%`)
		setDataCustomer(data);
		setTotalCustomer(totalCustomer?.length);
		console.log(data)
		setPage(1)
		setLoadingTable(false)
	}

	const changePagination = async (page) => {
		setLoadingTable(true)
		setPage(page);
		if (search) {
			const {
				data,
			} = await supabase.from('customer').select('*', {count: 'exact'}).filter('customer_name', 'ilike', `%${search}%`).range((page - 1) * 5, page * 5 - 1);
			setDataCustomer(data);
		} else {
			const {
				data,
				error
			} = await supabase.from('customer').select('*').range((page - 1) * 5, page * 5 - 1);
			setDataCustomer(data);
		}
		setLoadingTable(false)
	}

	return (
		<>
			<Head>
				<title>Khách Hàng</title>
			</Head>
			<div className='container'>
				<div className="layout">
					<div className='form'>
						<div className='title'>Thêm khách hàng</div>
						<div className='field'>
							<p>Tên khách hàng</p>
							<Input value={customerName} onChange={e => setCustomerName(e.target.value)}/>
						</div>
						<div className='field'>
							<p>Vị trí khách hàng <span className='sub_label'>(có thể copy kinh độ vĩ độ ở trên google map vào)</span>
							</p>
							<div className="field_location">
								<Button type="primary" onClick={getLocation} loading={loadingLocation}>
									Lấy vị trí hiện tại
								</Button>
								<Input
									value={location}
									onChange={e => setLocation(e.target.value)}/>
							</div>
						</div>
						<div className='field'>
							<p>Địa chỉ</p>
							<Input
								value={address}
								onChange={e => setAddress(e.target.value)}/>
						</div>
						<p className='error'>{error}</p>
						<Button type="primary" onClick={submit}>
							Thêm khách hàng
						</Button>
					</div>

					<div className='table'>
						<div className='title'>Danh sách khách hàng</div>
						<Search placeholder="Tìm kiếm khách hàng" onSearch={onSearch} enterButton/>
						<Table columns={columns} dataSource={dataCustomer} pagination={false} loading={loadingTable}/>
						<Pagination current={page} onChange={changePagination} defaultPageSize={5} total={totalCustomer}/>
					</div>
				</div>
			</div>
		</>
	)
}
