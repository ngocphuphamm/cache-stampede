# Cache Stampede
Khi bạn viết một dịch vụ stateless, nó xử lý tất cả các yêu cầu đến nhưng không giữ bất kỳ dữ liệu nào, và cần tham chiếu đến backend để thực sự lấy những gì cần thiết. Các cơ sở dữ liệu được lưu trữ trên disk-backed thông thường được sử dụng trong sản xuất ứng dụng web có thể hơi chậm vì chúng phụ thuộc vào I/O đĩa, một quá trình chậm. Điều này tạo ra vấn đề độ trễ. Một giải pháp phổ biến để giải quyết vấn đề này là sử dụng bộ nhớ đệm; trước khi truy cập backend, bạn sẽ kiểm tra xem giá trị mong muốn có sẵn hay không.


Tại một thời điểm nào đó, bạn chắc chắn đã sử dụng đoạn code này:
```
if (cache.containsKey(key)) {  
return cache.get(key)  
} else {  
value = fetchFromDb(key)  
cache.set(key, value)  
return value  
}

```

Đây là giải pháp đơn giản nhất. Nhưng nó chỉ hoạt động cho đến khi bạn không nhận được nhiều yêu cầu đồng thời.

Để cho bạn một ví dụ, hãy tưởng tượng bạn đang thực hiện một truy vấn SQL tốn kém và mất khoảng 2 giây để hoàn thành. Chạy nhiều trong số đó đồng thời có thể tăng hiệu suất CPU của máy chủ cơ sở dữ liệu. Để tự cứu mình khỏi tình huống như vậy, bạn đã lưu trữ kết quả truy vấn vào bộ nhớ đệm.

Bây giờ hãy xem xét bạn có lưu lượng truy cập là 1000 yêu cầu mỗi giây. Trong trường hợp bộ đệm của bạn không được điền, bạn sẽ có 1000 quy trình chạy cùng một truy vấn không được lưu trong bộ đệm. Nếu máy chủ cơ sở dữ liệu của bạn không thể xử lý tải như vậy, nó sẽ gây ra một lượng lớn dữ liệu. Hiện tượng này được gọi là Cache Stampede.


Sự cố Cache Stampede gây ra tình trạng ngừng hoạt động như thế nào?

Cache Stampede có sức tàn phá khủng khiếp đến mức có thể dẫn đến một vòng lặp lỗi.
- Nếu bộ đệm bị nguội, tất cả các yêu cầu đồng thời sẽ gọi đến cơ sở dữ liệu.
- Cơ sở dữ liệu gặp sự cố với CPU tăng đột biến và dẫn đến lỗi hết thời gian chờ.
- Khi nhận được thời gian chờ, tất cả các luồng sẽ cố gắng thử lại, gây ra một vụ giẫm đạp lớn khác.


# **Avoiding Cache Stampede**

Nói chung, có ba cách tiếp cận để tránh tình trạng  Cache Stampede:
1. Early Expiration
2. Locks And Promises

### Early Expiration

- Ý tưởng đằng sau việc hết hạn sớm là trước khi khóa bộ đệm hết hạn, giá trị của chúng sẽ được tính toán lại (Bên ngoài vòng lặp yêu cầu-phản hồi) và thời hạn hết hạn sẽ được kéo dài. Điều này sẽ đảm bảo rằng lỗi bộ nhớ đệm không bao giờ xảy ra.

- Điều này có thể được thực hiện dễ dàng bằng phương pháp nền hoặc công việc định kỳ. Ví dụ: nếu TTL của bất kỳ bộ đệm nào là 1 giờ và mất khoảng 1 phút để tính toán dữ liệu. Một công việc định kỳ sẽ chạy sau mỗi 55 phút để cập nhật bộ nhớ đệm và thời gian hết hạn của nó.\

- Hạn chế chính của phương pháp này là trừ khi bạn biết chính xác khóa bộ đệm nào sẽ là usd, bạn sẽ cần phải tính toán lại tất cả các khóa trong bộ đệm. Đây có thể là một quá trình rất tốn kém. Cùng với đó sẽ tăng cường bảo trì hệ thống khác (cron job) vì nếu thất bại thì không có lối thoát dễ dàng.


## Locks And Promises

- Trong các hệ thống có tính đồng thời cao, cách phổ biến nhất để ngăn chặn Cache Stampede là sử dụng khóa. Khóa có thể được sử dụng trong bộ nhớ đệm từ xa.

- Bằng cách đặt khóa trên khóa bộ đệm, chỉ một người gọi có thể truy cập dữ liệu từ cơ sở dữ liệu. Các yêu cầu đồng thời khác trên cùng bộ đệm sẽ ở trạng thái khóa. Bất kỳ yêu cầu mới nào khác trên bộ đệm đều phải đợi khóa được giải phóng.

- Bây giờ câu hỏi đặt ra là làm thế nào để xử lý tất cả các luồng đang chờ khóa được giải phóng?

- Có thể sử dụng  spinlock pattern nhưng điều đó có thể tạo ra tình huống chờ đợi bận rộn. Nó có thể thực sự đắt tiền. Ngoài ra, nếu việc thực hiện truy vấn tốn nhiều thời gian và trong khoảng thời gian đó nếu bộ nhớ đệm cạn kiệt nhóm kết nối có sẵn thì điều đó sẽ dẫn đến việc các yêu cầu kết nối bị loại bỏ.

	#### **How promises prevent spin locks ?**
	 - Instagram đã giải quyết vấn đề trên bằng cách đưa ra promise trong bộ đệm. Thay vì lưu giá trị thực vào bộ nhớ đệm, promise sẽ được lưu vào bộ đệm, cuối cùng trả về giá trị. Khi bạn sử dụng bộ đệm và gặp lỗi, bạn tạo một promise và lưu nó vào bộ đệm thay vì chuyển ngay đến phần backend. Sau đó, hoạt động chống lại backend sẽ được bắt đầu bằng Promise mới này. Các yêu cầu đồng thời khác sẽ không bị ảnh hưởng vì chúng sẽ tìm thấy lời hứa hiện có và tất cả các worker này sẽ chờ một yêu cầu backend.